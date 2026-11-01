import type { EventType } from '@shared/schemas';
import { getRunSheet } from '@shared/runsheet';
import './dashboard.css';
interface RunSheetTabProps {
  eventType: EventType;
  eventDate: string;
}
export const RunSheetTab = ({ eventType, eventDate }: RunSheetTabProps) => {
  const sheet = getRunSheet(eventType);
  return (
    <div className="dashboard-stack">
      <section className="dashboard-card">
        <h2>
          <span aria-hidden="true">📋 </span>Day-of Run Sheet — {sheet.eventLabel}
        </h2>
        <p>
          Event date: <strong>{eventDate}</strong> · Share with your coordinator and vendors for a
          smooth day.
        </p>
      </section>
      <div role="list" aria-label="Day-of run sheet tasks" className="dashboard-stack">
        {sheet.blocks.map((block) => (
          <div
            key={`${block.time}-${block.task}`}
            role="listitem"
            className="dashboard-card dashboard-run-block"
          >
            <strong>{block.time}</strong>
            <div>
              <p>{block.task}</p>
              {block.notes && <p className="dashboard-muted">{block.notes}</p>}
              <p>Owner: {block.owner}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
