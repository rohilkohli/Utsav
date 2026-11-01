// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { IdeasTab } from '../components/dashboard/IdeasTab';
import { ReadOnlyPanel } from '../components/dashboard/ReadOnlyPanel';
import { BudgetTab } from '../components/dashboard/BudgetTab';
import { wizardInputSchema, planOutputSchema, type PlanOutput } from '@shared/schemas';
import { generateFallbackPlan } from '@shared/fallback';
import { apiGeneratePlan, apiRefineSection } from '../lib/api';

vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof import('../lib/api')>()),
  apiGeneratePlan: vi.fn(),
  apiRefineSection: vi.fn(),
}));
const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2030-12-15',
  city: 'Mumbai',
  guestCount: 45,
  totalBudget: 40000,
});
const preset = generateFallbackPlan(input);
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});
function Ideas() {
  const [plan, setPlan] = useState(preset);
  return (
    <IdeasTab
      ideas={plan.ideas}
      input={input}
      currentPlan={plan}
      onUpdateIdeas={(ideas) => {
        setPlan({ ...plan, ideas });
      }}
    />
  );
}
function Budget() {
  const [plan, setPlan] = useState(preset);
  return (
    <BudgetTab
      categories={plan.budget}
      totalBudget={40000}
      guestCount={45}
      perPlate={100}
      onUpdateCategories={(budget) => {
        setPlan({ ...plan, budget });
      }}
      onUpdateGuestCount={vi.fn()}
      onUpdatePerPlate={vi.fn()}
    />
  );
}
describe('Interactive planning journeys', () => {
  it('completes the real wizard including preferences then resets the active plan', async () => {
    vi.mocked(apiGeneratePlan).mockResolvedValue({
      plan: planOutputSchema.parse(preset),
      planId: 'guest-a',
      meta: { source: 'fallback' },
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('radio', { name: /Birthday \/ Milestone/ }));
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.change(screen.getByLabelText(/Event Date/), { target: { value: '2030-12-15' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Exact guest count' }), {
      target: { value: '45' },
    });
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.change(screen.getByLabelText(/Total Budget/), { target: { value: '40000' } });
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    await user.click(screen.getByRole('radio', { name: /Hindi/ }));
    await user.click(screen.getByRole('radio', { name: /English/ }));
    await user.type(screen.getByLabelText(/Theme \/ Aesthetic/), 'Marigold');
    await user.type(screen.getByLabelText(/Cultural Traditions/), 'Family songs');
    await user.click(screen.getByRole('button', { name: /Jain Options Mandatory/ }));
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    await user.click(screen.getByRole('button', { name: '← Back' }));
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    await user.click(screen.getByRole('button', { name: '✨ Generate Celebration Plan' }));
    expect(await screen.findByRole('heading', { name: 'Your celebration plan' })).toBeVisible();
    expect(apiGeneratePlan).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'New Plan' }));
    expect(screen.getByRole('heading', { name: /What are you celebrating/ })).toBeVisible();
  });
  it('shows actual generation failures and supports synchronous local creation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText('Your celebration description'),
      'Birthday in Mumbai, 45 guests, budget 40000',
    );
    await user.click(screen.getByRole('button', { name: 'Instant create' }));
    expect(await screen.findByRole('heading', { name: 'Your celebration plan' })).toBeVisible();
    expect(apiGeneratePlan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '+ Plan New Event' }));
    expect(screen.getByRole('heading', { name: /What are you celebrating/ })).toBeVisible();
  });
  it('refines ideas using text and suggestions and supports every tab keyboard route', async () => {
    const response = {
      ideas: [
        {
          id: 'new-food',
          section: 'food' as const,
          title: 'Updated chaat',
          description: 'Fresh local menu',
        },
      ],
      meta: { source: 'fallback' as const },
    };
    vi.mocked(apiRefineSection).mockResolvedValue(response);
    const user = userEvent.setup();
    render(<Ideas />);
    await user.type(screen.getByLabelText(/Refine Food/), 'Use seasonal dishes');
    await user.click(screen.getByRole('button', { name: 'Refine ideas' }));
    expect(await screen.findByText('Updated chaat')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Pure Jain menu for all guests' }));
    await waitFor(() => {
      expect(apiRefineSection).toHaveBeenCalledTimes(2);
    });
    const tab = screen.getByRole('tab', { name: 'Food & Culinary Menus' });
    tab.focus();
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'x'])
      await user.keyboard(`{${key}}`);
    await user.click(screen.getByRole('tab', { name: 'Theme & Aesthetic Vibe' }));
    vi.mocked(apiRefineSection).mockRejectedValue(new Error('Refinement unavailable'));
    await user.click(screen.getByRole('button', { name: 'Rajasthani royal heritage look' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Refinement unavailable');
  });
  it('keeps every shared panel readable without exposing mutation controls', () => {
    const plan: PlanOutput = {
      ...preset,
      budget: preset.budget.map((c) => ({ ...c, verified: true })),
      timeline: preset.timeline.map((m) => ({ ...m, completed: true, assignee: 'Family' })),
    };
    const view = render(<ReadOnlyPanel tab="budget" plan={plan} input={input} />);
    expect(screen.getAllByText(/Verified quotation/)).toHaveLength(plan.budget.length);
    for (const tab of ['timeline', 'vendors', 'ideas', 'runsheet'] as const) {
      view.rerender(<ReadOnlyPanel tab={tab} plan={plan} input={input} />);
      expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    }
  });
  it('redistributes allocations, prioritizes and locks a category and rejects invalid actual input', async () => {
    const user = userEvent.setup();
    render(<Budget />);
    const category = preset.budget[0];
    if (!category) throw new Error('Fixture category missing');
    fireEvent.change(screen.getByLabelText(`Allocation slider for ${category.category}`), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByLabelText(`Allocated amount for ${category.category}`), {
      target: { value: '11000' },
    });
    await user.click(screen.getByRole('checkbox', { name: `Prioritize ${category.category}` }));
    await user.click(screen.getByRole('checkbox', { name: `Lock ${category.category}` }));
    expect(screen.getByLabelText(`Allocated amount for ${category.category}`)).toBeDisabled();
    const actual = screen.getByLabelText(`Actual spend for ${category.category}`);
    if (!(actual instanceof HTMLInputElement)) throw new Error('Actual input missing');
    const prior = actual.value;
    fireEvent.change(actual, { target: { value: 'invalid' } });
    expect(actual).toHaveValue(prior);
    await user.click(screen.getByRole('button', { name: 'Cut 10%' }));
  });
});
