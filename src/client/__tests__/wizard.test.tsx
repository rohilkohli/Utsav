import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { WizardShell } from '../components/wizard/WizardShell';
import { AuthProvider } from '../components/auth/AuthContext';

describe('Wizard Component & Accessibility (vitest-axe)', () => {
  it('renders Step 1 (EventTypeStep) with zero axe accessibility violations', async () => {
    const onGenerate = vi.fn();
    const { container } = render(
      <AuthProvider>
        <WizardShell onGeneratePlan={onGenerate} isGenerating={false} />
      </AuthProvider>,
    );

    expect(screen.getByText('What are you celebrating?')).toBeInTheDocument();
    expect(screen.getByText('Indian Wedding')).toBeInTheDocument();
    expect(screen.getByText('Birthday / Milestone')).toBeInTheDocument();
    expect(screen.getByText('Community Festival')).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('navigates through steps and allows customization', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(
      <AuthProvider>
        <WizardShell onGeneratePlan={onGenerate} isGenerating={false} />
      </AuthProvider>,
    );

    // Step 1 -> Step 2
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    await user.click(continueBtn);

    expect(screen.getByText(/when and where is the celebration/i)).toBeInTheDocument();

    // Step 2 -> Step 3
    await user.click(continueBtn);
    expect(screen.getByText(/what is your total target budget/i)).toBeInTheDocument();

    // Step 3 -> Step 4
    await user.click(continueBtn);
    expect(screen.getByText(/personalize your celebration vibe/i)).toBeInTheDocument();

    // Step 4 -> Step 5
    await user.click(continueBtn);
    expect(screen.getByText(/review & generate your plan/i)).toBeInTheDocument();

    // Click Generate
    const generateBtn = screen.getByRole('button', { name: /generate celebration plan/i });
    await user.click(generateBtn);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
