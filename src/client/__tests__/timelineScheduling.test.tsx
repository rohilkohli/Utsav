// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimelineTab } from '../components/dashboard/TimelineTab';
import { ReadOnlyPanel } from '../components/dashboard/ReadOnlyPanel';
import { PrintSummary } from '../components/dashboard/PrintSummary';
import { generateICS } from '../../shared/ics';
import { input, plan, task, today } from '../../shared/__tests__/fixtures';
import { prepareTimeline } from '../../shared/timelinePreparation';
vi.mock('../../shared/ics', async (original) => ({
  ...(await original<typeof import('../../shared/ics')>()),
  generateICS: vi.fn(() => 'calendar'),
}));
afterEach(() => vi.restoreAllMocks());

it('shows compression only for prepared short-notice plans and respects slack in pushed labels', () => {
  const milestones = [{ ...task('venue', 20), delayDays: 1 }, task('decor', 10, ['venue'])];
  const view = render(
    <TimelineTab
      milestones={milestones}
      eventDate={input.eventDate}
      today={today}
      onToggleMilestone={vi.fn()}
    />,
  );
  expect(screen.queryByText(/Schedule compressed/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Pushed by delayed task/)).not.toBeInTheDocument();
  const prepared = prepareTimeline({ timeline: milestones }, '2030-01-06', today);
  view.rerender(
    <TimelineTab
      milestones={prepared.timeline}
      compression={prepared.timelineCompression}
      eventDate="2030-01-06"
      today={today}
      onToggleMilestone={vi.fn()}
    />,
  );
  expect(screen.getByText(/Schedule compressed from 20 to 5/)).toBeVisible();
});

it('bounds edited delays, disables finished delays and exports actual effective dates', () => {
  const update = vi.fn();
  const milestones = [
    { ...task('venue', 20), delayDays: 15 },
    task('decor', 10, ['venue']),
    { ...task('finished', 0), status: 'done' as const },
  ];
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  render(
    <TimelineTab
      milestones={milestones}
      eventDate={input.eventDate}
      today={today}
      onToggleMilestone={vi.fn()}
      onUpdateMilestones={update}
    />,
  );
  expect(screen.getByText(/Pushed by delayed task: venue/)).toBeVisible();
  expect(screen.getByLabelText('Delay days for finished')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Delay days for venue'), { target: { value: '999' } });
  expect(update).toHaveBeenLastCalledWith(
    expect.arrayContaining([expect.objectContaining({ id: 'venue', delayDays: 365 })]),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Export .ics Calendar' }));
  expect(generateICS).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ title: 'decor', dateStr: '2030-01-30' })]),
  );
  expect(screen.getAllByRole('link', { name: /Add to Google Calendar/ })[1]).toHaveAttribute(
    'href',
    expect.stringContaining('20300130'),
  );
});

it('uses effective dates consistently in shared and printed timelines and reports invalid graphs', () => {
  const current = plan({
    timeline: [{ ...task('venue', 20), delayDays: 15 }, task('decor', 10, ['venue'])],
  });
  const view = render(<ReadOnlyPanel tab="timeline" plan={current} input={input} today={today} />);
  expect(screen.getByText(/2030-01-30: decor/)).toBeVisible();
  expect(screen.getByText(/Pushed by delayed task: venue/)).toBeVisible();
  view.rerender(<PrintSummary plan={current} input={input} today={today} />);
  expect(screen.getByText('2030-01-30: decor')).toBeVisible();
  view.rerender(
    <PrintSummary
      plan={plan({ timeline: [task('broken', 0, ['missing'])] })}
      input={input}
      today={today}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Unknown dependency');
});
