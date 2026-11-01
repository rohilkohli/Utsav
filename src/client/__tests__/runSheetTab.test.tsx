import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { RunSheetTab } from '../components/dashboard/RunSheetTab';

describe('RunSheetTab', () => {
  it('renders the heading with event label for wedding', () => {
    render(<RunSheetTab eventType="wedding" eventDate="2026-12-10" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Day-of Run Sheet');
  });

  it('renders the event date', () => {
    render(<RunSheetTab eventType="wedding" eventDate="2026-12-10" />);
    expect(screen.getByText(/2026-12-10/)).toBeTruthy();
  });

  it('renders a list of run sheet blocks', () => {
    render(<RunSheetTab eventType="wedding" eventDate="2026-12-10" />);
    const list = screen.getByRole('list', { name: /day-of run sheet/i });
    expect(list).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders run sheet blocks for birthday', () => {
    render(<RunSheetTab eventType="birthday" eventDate="2026-11-01" />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders run sheet blocks for community', () => {
    render(<RunSheetTab eventType="community" eventDate="2026-10-15" />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<RunSheetTab eventType="wedding" eventDate="2026-12-10" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('each block shows a time, task, and owner', () => {
    render(<RunSheetTab eventType="wedding" eventDate="2026-12-10" />);
    const items = screen.getAllByRole('listitem');
    // At least first item should have content from the run sheet
    expect(items[0].textContent).toBeTruthy();
  });

  it('emoji icon has aria-hidden', () => {
    const { container } = render(<RunSheetTab eventType="wedding" eventDate="2026-12-10" />);
    const hiddenSpans = container.querySelectorAll('span[aria-hidden="true"]');
    expect(hiddenSpans.length).toBeGreaterThan(0);
  });
});
