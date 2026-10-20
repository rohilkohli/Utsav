import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { AuthProvider } from '../components/auth/AuthContext';
import type { PlanOutput, WizardInput } from '@shared/schemas';

const mockInput: WizardInput = {
  eventType: 'wedding',
  subEvents: ['Haldi', 'Mehendi', 'Sangeet', 'Wedding Ceremony'],
  eventDate: '2026-12-15',
  city: 'Udaipur',
  guestCount: 200,
  totalBudget: 2_000_000,
  theme: 'Royal Palace Lakeview',
  dietaryPreferences: ['Pure Vegetarian (No Onion/Garlic)'],
  culturalNotes: 'Traditional Mewari ceremonies',
  language: 'english',
};

const mockPlan: PlanOutput = {
  summary: 'A breathtaking royal lakeside wedding in Udaipur for 200 honored guests.',
  budget: [
    { id: '1', category: 'Venue & Palace Lawn', suggestedPercent: 35, amount: 700000, actual: 700000, subEvent: 'Wedding Ceremony' },
    { id: '2', category: 'Royal Catering', suggestedPercent: 30, amount: 600000, actual: 650000, subEvent: 'Wedding Ceremony' },
    { id: '3', category: 'Mandap Floral Decor', suggestedPercent: 20, amount: 400000, actual: 400000, subEvent: 'Wedding Ceremony' },
    { id: '4', category: 'Folk Artists & Dhol', suggestedPercent: 15, amount: 300000, actual: 300000, subEvent: 'Sangeet' },
  ],
  timeline: [
    { id: 'm1', title: 'Book Palace Venue', description: 'Lock in dates', daysBeforeEvent: 180, date: '2026-06-18', completed: true },
    { id: 'm2', title: 'Food Tasting & Menu Lock', description: 'Sample royal thalis', daysBeforeEvent: 60, date: '2026-10-16', completed: false },
    { id: 'm3', title: 'Wedding Day Pheras', description: 'Main sunset ceremony', daysBeforeEvent: 0, date: '2026-12-15', completed: false },
  ],
  vendors: [
    {
      id: 'v1',
      category: 'Palace Decorator',
      questionsToAsk: ['Are real flowers used for the floating mandap?', 'What is backup for rain?'],
      bookByDaysBeforeEvent: 90,
      bookByDate: '2026-09-16',
      status: 'booked',
      quotedAmount: 400000,
      budgetedAmount: 400000,
      subEvent: 'Wedding Ceremony',
    },
    {
      id: 'v2',
      category: 'Rajasthani Caterer',
      questionsToAsk: ['Can you set up 5 live counters?', 'Do you provide copper service ware?'],
      bookByDaysBeforeEvent: 60,
      bookByDate: '2026-10-16',
      status: 'quoted',
      quotedAmount: 650000,
      budgetedAmount: 600000,
      subEvent: 'Wedding Ceremony',
    },
  ],
  ideas: [
    { id: 'i1', section: 'theme', title: 'Lake Pichola Sunset Glow', description: 'Warm amber lights with floating diyas and brass thalis.' },
    { id: 'i2', section: 'decor', title: 'Marigold Canopy & Mirrorwork', description: 'Vibrant yellow florals draped with Rajasthani umbrellas.' },
    { id: 'i3', section: 'food', title: 'Live Dal Baati Churma & Ker Sangri', description: 'Traditional wood-fired baati with authentic ghee.' },
    { id: 'i4', section: 'activities', title: 'Ghoomar & Kalbelia Workshop', description: 'Folk dancers teaching guests traditional steps.' },
    { id: 'i5', section: 'returnGifts', title: 'Bandhani Dupattas & Blue Pottery', description: 'Artisanal local handcrafted souvenirs in silk pouches.' },
  ],
};

describe('Dashboard Component & Accessibility (vitest-axe)', () => {
  it('renders BudgetTab and passes zero axe accessibility violations', async () => {
    const onUpdate = vi.fn();
    const onNew = vi.fn();

    const { container } = render(
      <AuthProvider>
        <DashboardShell
          input={mockInput}
          plan={mockPlan}
          onUpdatePlan={onUpdate}
          onNewPlan={onNew}
        />
      </AuthProvider>,
    );

    expect(screen.getByText('Target Budget', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Venue & Palace Lawn')).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('switches to TimelineTab and checks zero axe accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthProvider>
        <DashboardShell
          input={mockInput}
          plan={mockPlan}
          onUpdatePlan={vi.fn()}
          onNewPlan={vi.fn()}
        />
      </AuthProvider>,
    );

    const timelineTab = screen.getByRole('tab', { name: /timeline/i });
    await user.click(timelineTab);

    expect(screen.getByText('Book Palace Venue')).toBeInTheDocument();
    expect(screen.getByText(/Export .ics Calendar/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('switches to VendorsTab and checks zero axe accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthProvider>
        <DashboardShell
          input={mockInput}
          plan={mockPlan}
          onUpdatePlan={vi.fn()}
          onNewPlan={vi.fn()}
        />
      </AuthProvider>,
    );

    const vendorsTab = screen.getByRole('tab', { name: /vendor checklist/i });
    await user.click(vendorsTab);

    expect(screen.getByText('Palace Decorator')).toBeInTheDocument();
    expect(screen.getByText(/Are real flowers used for the floating mandap/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('switches to IdeasTab and checks zero axe accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthProvider>
        <DashboardShell
          input={mockInput}
          plan={mockPlan}
          onUpdatePlan={vi.fn()}
          onNewPlan={vi.fn()}
        />
      </AuthProvider>,
    );

    const ideasTab = screen.getByRole('tab', { name: /personalized ideas/i });
    await user.click(ideasTab);

    expect(screen.getByLabelText(/Refine Food & Culinary Menus with AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Dal Baati Churma/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
