const steps = ['Type', 'Details', 'Budget', 'Vibe', 'Review'];
const tips = [
  'Select ceremonies for dedicated budgets, milestones and vendor questions for each function.',
  'Your Indian city and event date shape the timeline and vendor booking deadlines.',
  'Budget allocations use deterministic rupee math and add up exactly to your budget.',
  'Describe your theme, dietary preferences and cultural notes for more personal ideas.',
  'Review your details before creating the budget, timeline, vendor checklist and ideas.',
];
export function WizardProgress({ step }: { step: number }) {
  return (
    <>
      <nav aria-label="Planning Progress" className="wizard-shell-nav-2">
        <ol className="wizard-shell-ol-3">
          {steps.map((label, index) => (
            <li key={label} className="wizard-shell-li-4">
              <span
                aria-current={index + 1 === step ? 'step' : undefined}
                className={`wizard-progress-number ${index + 1 <= step ? 'wizard-progress-number--active' : ''}`}
              >
                {index + 1 < step ? '✓' : index + 1}
              </span>
              <span className={index + 1 === step ? 'wizard-progress-current' : ''}>{label}</span>
            </li>
          ))}
        </ol>
      </nav>
      <p className="wizard-shell-div-7">💡 {tips[step - 1]}</p>
    </>
  );
}
