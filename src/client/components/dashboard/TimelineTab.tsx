import { memo, useMemo } from 'react';
import type { Milestone } from '@shared/schemas';
import { getTodayInKolkata } from '@shared/schemas';
import {
  affectedByDelays,
  buildSchedule,
  compressTasks,
  getCountdownToEvent,
  phaseFor,
} from '@shared/timeline';
import { generateICS, createGoogleCalendarUrl } from '@shared/ics';
import './dashboard.css';
interface TimelineTabProps {
  milestones: Milestone[];
  eventDate: string;
  today?: string;
  onToggleMilestone: (id: string) => void;
  onUpdateMilestones?: (milestones: Milestone[]) => void;
}
export const TimelineTab = memo(function TimelineTab({
  milestones,
  eventDate,
  today = getTodayInKolkata(),
  onToggleMilestone,
  onUpdateMilestones,
}: TimelineTabProps) {
  const countdown = getCountdownToEvent(eventDate, today);
  const schedule = useMemo(() => {
    try {
      return {
        tasks: buildSchedule(compressTasks(milestones, eventDate, today), eventDate, today),
        error: '',
      };
    } catch (error) {
      return {
        tasks: [],
        error: error instanceof Error ? error.message : 'Invalid timeline dependencies',
      };
    }
  }, [milestones, eventDate, today]);
  const pushed = useMemo(
    () => (schedule.error ? new Map<string, string[]>() : affectedByDelays(milestones)),
    [milestones, schedule.error],
  );
  const completed = milestones.filter((m) => m.completed === true || m.status === 'done').length;
  const download = () => {
    const content = generateICS(
      schedule.tasks.map((m) => ({
        title: m.title,
        description: `${m.description}${m.subEvent ? ` [Ceremony: ${m.subEvent}]` : ''}`,
        dateStr: m.effectiveDate,
      })),
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `utsav-celebration-${eventDate}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const delay = (id: string, days: number) =>
    onUpdateMilestones?.(
      milestones.map((m) =>
        m.id === id
          ? {
              ...m,
              delayDays: days,
              status:
                days > 0
                  ? ('delayed' as const)
                  : m.completed
                    ? ('done' as const)
                    : ('todo' as const),
            }
          : m,
      ),
    );
  return (
    <div className="dashboard-stack">
      <section className="dashboard-card">
        <h2>Timeline & Milestones</h2>
        <p>
          {countdown.label} · {completed} of {milestones.length} milestones complete
        </p>
        <progress
          className="dashboard-progress"
          aria-label="Milestones completed"
          value={completed}
          max={Math.max(1, milestones.length)}
        />
        <p className="dashboard-muted">
          Tasks adapt to your available runway. Dependencies and delays update every task and
          calendar export.
        </p>
        <button type="button" className="dashboard-button" onClick={download}>
          Export .ics Calendar
        </button>
      </section>
      {schedule.error && (
        <p role="alert" className="dashboard-card dashboard-warning">
          {schedule.error}
        </p>
      )}
      <ol className="dashboard-timeline">
        {schedule.tasks.map((m) => (
          <li key={m.id}>
            <article
              className={`dashboard-card ${m.flags.impossible || m.flags.overdue ? 'dashboard-warning' : ''}`}
            >
              <p className="dashboard-muted">
                {phaseFor(m.daysBeforeEvent)}
                {m.subEvent && ` · ${m.subEvent}`}
              </p>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
              <p>
                Due: <time dateTime={m.effectiveDate}>{m.effectiveDate}</time>
                {m.assignee && ` · Owner: ${m.assignee}`}
              </p>
              {(pushed.get(m.id) ?? []).map((title) => (
                <p key={title} className="dashboard-warning">
                  ⚠ Pushed by delayed task: {title}
                </p>
              ))}
              {m.flags.impossible && <p>Cannot finish before the celebration date</p>}
              {m.flags.overdue && <p>Overdue</p>}
              {m.flags.atRisk && <p>At risk from delay</p>}
              <div className="dashboard-row">
                <label>
                  <input
                    type="checkbox"
                    checked={m.completed === true || m.status === 'done'}
                    onChange={() => {
                      onToggleMilestone(m.id);
                    }}
                  />{' '}
                  Mark {m.title} complete
                </label>
                <a
                  className="dashboard-button"
                  href={createGoogleCalendarUrl({
                    title: m.title,
                    description: m.description,
                    dateStr: m.effectiveDate,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Add to Google Calendar<span className="sr-only"> (opens in new tab)</span>
                </a>
              </div>
              {onUpdateMilestones && (
                <div className="dashboard-grid">
                  <label className="dashboard-label">
                    Delay days for {m.title}
                    <input
                      className="dashboard-input"
                      type="number"
                      min={0}
                      max={365}
                      value={m.delayDays ?? 0}
                      onChange={(e) => delay(m.id, Math.max(0, Math.round(Number(e.target.value))))}
                    />
                  </label>
                  <label className="dashboard-label">
                    Assignee for {m.title}
                    <input
                      className="dashboard-input"
                      value={m.assignee ?? ''}
                      onChange={(e) => {
                        onUpdateMilestones(
                          milestones.map((task) =>
                            task.id === m.id ? { ...task, assignee: e.target.value } : task,
                          ),
                        );
                      }}
                    />
                  </label>
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
});
