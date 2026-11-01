// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PreferencesStep } from '../components/wizard/PreferencesStep';
import { EventTypeStep } from '../components/wizard/EventTypeStep';
import { EventDetailsStep } from '../components/wizard/EventDetailsStep';
import { TimelineTab } from '../components/dashboard/TimelineTab';
import { task } from '../../shared/__tests__/fixtures';

it('supports every celebration type and ceremony selector with linked validation', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const toggle = vi.fn();
  const props = {
    eventType: 'wedding' as const,
    subEvents: ['Haldi'],
    onChangeType: change,
    onToggleSubEvent: toggle,
  };
  const view = render(<EventTypeStep {...props} errors={{ subEvents: 'Choose a ceremony' }} />);
  for (const name of [/Indian Wedding/, /Birthday \/ Milestone/, /Community Festival/])
    await user.click(screen.getByRole('radio', { name }));
  await user.click(screen.getByRole('button', { name: /Haldi/ }));
  expect(toggle).toHaveBeenCalledWith('Haldi');
  view.rerender(<EventTypeStep {...props} eventType="community" subEvents={['Pandal Setup']} />);
  await user.click(screen.getByRole('button', { name: /Pandal Setup/ }));
  await user.click(screen.getByRole('button', { name: /Visarjan/ }));
  expect(toggle).toHaveBeenCalledWith('Visarjan / Procession');
  expect(change).toHaveBeenCalledTimes(3);
});
it('updates language, cultural notes, dietary traditions and error descriptions', async () => {
  const user = userEvent.setup();
  const theme = vi.fn(),
    notes = vi.fn(),
    language = vi.fn(),
    diet = vi.fn();
  render(
    <PreferencesStep
      theme=""
      dietaryPreferences={['Jain Options Mandatory']}
      culturalNotes=""
      language="hindi"
      onChangeTheme={theme}
      onChangeCulturalNotes={notes}
      onChangeLanguage={language}
      onToggleDietary={diet}
      errors={{ theme: 'Theme is too long', culturalNotes: 'Notes are too long' }}
    />,
  );
  await user.click(screen.getByRole('radio', { name: /English/ }));
  await user.click(screen.getByRole('radio', { name: /Hindi/ }));
  fireEvent.change(screen.getByLabelText(/Theme \/ Aesthetic/), { target: { value: 'Marigold' } });
  fireEvent.change(screen.getByLabelText(/Cultural Traditions/), {
    target: { value: 'Family songs' },
  });
  await user.click(screen.getByRole('button', { name: /Jain Options Mandatory/ }));
  expect(theme).toHaveBeenCalledWith('Marigold');
  expect(notes).toHaveBeenCalledWith('Family songs');
  expect(diet).toHaveBeenCalledWith('Jain Options Mandatory');
  expect(language).toHaveBeenLastCalledWith('hindi');
  expect(screen.getByLabelText(/Theme \/ Aesthetic/)).toHaveAttribute(
    'aria-describedby',
    'theme-error',
  );
});
it('supports city shortcuts, guest sliders, empty and out-of-range guest values', async () => {
  const user = userEvent.setup();
  const city = vi.fn(),
    guests = vi.fn(),
    date = vi.fn();
  render(
    <EventDetailsStep
      city="Mumbai"
      guestCount={45}
      eventDate="2030-12-15"
      onChangeCity={city}
      onChangeGuests={guests}
      onChangeDate={date}
      errors={{ city: 'Choose city', guestCount: 'Guest value invalid', eventDate: 'Choose date' }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Jaipur' }));
  expect(city).toHaveBeenCalledWith('Jaipur');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '500' } });
  expect(guests).toHaveBeenLastCalledWith(500);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Exact guest count' }), {
    target: { value: '' },
  });
  expect(guests).toHaveBeenLastCalledWith(0);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Exact guest count' }), {
    target: { value: '20000' },
  });
  expect(guests).toHaveBeenLastCalledWith(10000);
  fireEvent.change(screen.getByLabelText(/Event Date/), { target: { value: '2030-12-16' } });
  expect(date).toHaveBeenCalledWith('2030-12-16');
});
it('reports invalid dependency graphs and exports adjusted valid dates without crashing', async () => {
  const user = userEvent.setup();
  const update = vi.fn(),
    toggle = vi.fn();
  const view = render(
    <TimelineTab
      milestones={[task('a', 10, ['missing'])]}
      eventDate="2030-02-01"
      today="2030-01-01"
      onToggleMilestone={toggle}
      onUpdateMilestones={update}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Unknown');
  const milestones = [
    { ...task('a', 15), completed: true, subEvent: 'Haldi' },
    task('b', 5, ['a']),
  ];
  view.rerender(
    <TimelineTab
      milestones={milestones}
      eventDate="2030-02-01"
      today="2030-01-01"
      onToggleMilestone={toggle}
      onUpdateMilestones={update}
    />,
  );
  const create = vi.fn(() => 'blob:calendar');
  const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  await user.click(screen.getByRole('button', { name: 'Export .ics Calendar' }));
  expect(create).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith('blob:calendar');
  await user.click(screen.getByRole('checkbox', { name: 'Mark a complete' }));
  expect(toggle).toHaveBeenCalledWith('a');
  fireEvent.change(screen.getByLabelText('Delay days for a'), { target: { value: '4' } });
  view.rerender(
    <TimelineTab
      milestones={[{ ...task('a', 15), completed: true, delayDays: 4 }, task('b', 5, ['a'])]}
      eventDate="2030-02-01"
      today="2030-01-01"
      onToggleMilestone={toggle}
      onUpdateMilestones={update}
    />,
  );
  fireEvent.change(screen.getByLabelText('Delay days for a'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Assignee for b'), { target: { value: 'Family' } });
  expect(update).toHaveBeenCalledTimes(3);
  vi.restoreAllMocks();
});
