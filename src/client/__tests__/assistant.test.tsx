// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAskPlanner, apiReviewPlan } from '../lib/api';
import { AssistantPanel } from '../components/dashboard/AssistantPanel';
import { ThinkingTrace } from '../components/shared/ThinkingTrace';
import { planInsights } from '@shared/insights';
import { input, plan } from './aiFixtures';

vi.mock('../lib/api', () => ({ apiAskPlanner: vi.fn(), apiReviewPlan: vi.fn() }));
vi.mock('@shared/insights', () => ({ planInsights: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(planInsights).mockReturnValue([]);
  vi.mocked(apiAskPlanner).mockResolvedValue({
    answer: '₹40,000 remains in your plan.',
    source: 'gemini',
  });
  vi.mocked(apiReviewPlan).mockResolvedValue({
    review: {
      strengths: ['Good budget'],
      risks: ['Book catering'],
      suggestions: ['Confirm dates'],
      overallScore: 8,
    },
    source: 'fallback',
  });
});

describe('assistant progress', () => {
  it('shows public operation summaries while running and collapses them once answered', () => {
    const { rerender } = render(
      <ThinkingTrace
        running
        steps={['Reading celebration details']}
        model={null}
        elapsedSeconds={3}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Gemini is thinking… 3s');
    expect(screen.getByText('Reading celebration details')).toBeVisible();
    rerender(
      <ThinkingTrace
        state={{
          running: false,
          steps: ['Reading celebration details'],
          model: 'gemini-flash',
          elapsedSeconds: 3,
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Answered by gemini-flash');
    expect(screen.getByText('How this answer was prepared (1 steps)')).toBeVisible();
    rerender(
      <ThinkingTrace
        running={false}
        steps={['Using deterministic plan facts']}
        model={null}
        elapsedSeconds={0}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Built-in Planner');
    rerender(<ThinkingTrace running={false} steps={[]} model={null} elapsedSeconds={0} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('planning assistant', () => {
  it('ranks the first three insights, expands the remaining ones, and navigates to their tabs', async () => {
    vi.mocked(planInsights).mockReturnValue([
      { id: 'a', severity: 'critical', tab: 'budget', message: 'Over budget' },
      { id: 'b', severity: 'warning', tab: 'timeline', message: 'Task delayed' },
      { id: 'c', severity: 'warning', tab: 'vendors', message: 'Vendor missing' },
      { id: 'd', severity: 'suggestion', tab: 'budget', message: 'Add contingency' },
    ]);
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<AssistantPanel plan={plan} input={input} onNavigate={navigate} />);
    expect(screen.queryByText('Add contingency')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show all 4 insights' }));
    expect(screen.getByText('Add contingency')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /critical Over budget/ }));
    expect(navigate).toHaveBeenCalledWith('budget');
    await user.click(screen.getByRole('button', { name: 'Show top three insights' }));
    expect(screen.queryByText('Add contingency')).toBeNull();
  });

  it('answers typed and suggested bilingual questions with accurate source labels', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel plan={plan} input={input} onNavigate={() => undefined} />);
    expect(screen.getByText('Your plan has no urgent issues today.')).toBeVisible();
    await user.type(
      screen.getByLabelText('Ask about budget, vendors, timing, or guests'),
      'How much budget remains?',
    );
    await user.click(screen.getByRole('button', { name: 'Ask planner' }));
    await waitFor(() => {
      expect(screen.getByText('Assistant (Gemini)')).toBeVisible();
    });
    expect(screen.getByText('₹40,000 remains in your plan.')).toBeVisible();
    vi.mocked(apiAskPlanner).mockResolvedValue({
      answer: 'अगला काम विक्रेता चुनना है।',
      source: 'fallback',
    });
    await user.click(screen.getByRole('button', { name: 'अगला काम क्या है?' }));
    expect(await screen.findByText('अगला काम विक्रेता चुनना है।')).toBeVisible();
    expect(screen.getAllByText('Assistant (Built-in Planner)').length).toBeGreaterThan(0);
  });

  it('keeps a grounded local answer on network failure and ignores an empty submit', async () => {
    vi.mocked(apiAskPlanner).mockRejectedValue(new Error('offline'));
    render(<AssistantPanel plan={plan} input={input} onNavigate={() => undefined} />);
    fireEvent.submit(
      screen.getByLabelText('Ask about budget, vendors, timing, or guests').closest('form') ??
        document.createElement('form'),
    );
    expect(apiAskPlanner).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Kitna paisa bacha hai?' }));
    expect(
      await screen.findByText('Using the built-in planner while AI is unavailable.'),
    ).toBeVisible();
    expect(screen.getByText(/₹40,000/, { selector: 'p' })).toBeVisible();
  });

  it('renders validated review sections and clears the review when the plan changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AssistantPanel plan={plan} input={input} onNavigate={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'Ask AI for a Plan Review' }));
    expect(await screen.findByText('Good budget')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Risks' })).toBeVisible();
    expect(screen.getByText(/Plan review · 8\/10/)).toHaveTextContent('Built-in Planner');
    rerender(
      <AssistantPanel
        plan={{ ...plan, summary: 'Updated' }}
        input={input}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.queryByText('Good budget')).toBeNull();
  });

  it('supports canceling a review and reports a real review failure', async () => {
    let reject: (error: Error) => void = () => undefined;
    vi.mocked(apiReviewPlan).mockImplementation(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    const user = userEvent.setup();
    render(<AssistantPanel plan={plan} input={input} onNavigate={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Ask AI for a Plan Review' }));
    await user.click(screen.getByRole('button', { name: 'Cancel review' }));
    expect(screen.queryByText('Reviewing plan…')).toBeNull();
    await act(async () => {
      reject(new Error('canceled'));
      await Promise.resolve();
    });
    vi.mocked(apiReviewPlan).mockRejectedValue(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Ask AI for a Plan Review' }));
    expect(await screen.findByText(/Plan review is currently unavailable/)).toBeVisible();
  });
});

it('dismisses a completed executive review and allows requesting a fresh one', async () => {
  const user = userEvent.setup();
  render(<AssistantPanel plan={plan} input={input} onNavigate={() => undefined} />);
  await user.click(screen.getByRole('button', { name: 'Ask AI for a Plan Review' }));
  expect(await screen.findByText('Good budget')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Dismiss plan review' }));
  expect(screen.queryByText('Good budget')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Dismiss plan review' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Ask AI for a Plan Review' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Ask AI for a Plan Review' }));
  expect(await screen.findByText('Good budget')).toBeVisible();
});
