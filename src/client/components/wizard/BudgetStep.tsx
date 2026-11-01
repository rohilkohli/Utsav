import './BudgetStep.css';
import React, { useEffect, useRef, useState } from 'react';
import type { FieldErrors } from './useWizardForm';
import type { EventType } from '@shared/schemas';
import { BUDGET_PRESETS } from '@shared/budget';
import { formatINR, parseINR } from '@shared/currency';

interface BudgetStepProps {
  errors?: FieldErrors;
  eventType: EventType;
  totalBudget: number;
  onChangeBudget: (budget: number) => void;
}

export const BudgetStep: React.FC<BudgetStepProps> = ({
  eventType,
  totalBudget,
  onChangeBudget,
  errors = {},
}) => {
  const [text, setText] = useState(Number.isFinite(totalBudget) ? formatINR(totalBudget) : '');
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(Number.isFinite(totalBudget) ? formatINR(totalBudget) : '');
  }, [totalBudget]);
  const presets = BUDGET_PRESETS[eventType];

  return (
    <div className={['budget-step-div-1'].join(' ')}>
      <div>
        <h2 className={['budget-step-h2-2'].join(' ')}>What is your total target budget?</h2>
        <p className={['budget-step-p-3'].join(' ')}>
          Utsav will allocate realistic percentages per category using deterministic rupee math.
        </p>
      </div>

      <div>
        <label htmlFor="total-budget-input" className={['budget-step-label-4'].join(' ')}>
          Total Budget in Indian Rupees (₹):
        </label>

        <div className={['budget-step-div-5'].join(' ')}>
          <input
            id="total-budget-input"
            type="text"
            value={text}
            aria-invalid={Boolean(errors.totalBudget)}
            aria-describedby={errors.totalBudget ? 'budget-error' : undefined}
            onFocus={() => {
              editing.current = true;
            }}
            onBlur={() => {
              editing.current = false;
              if (Number.isFinite(totalBudget)) setText(formatINR(totalBudget));
            }}
            placeholder="₹0"
            onChange={(e) => {
              setText(e.target.value);
              const parsed = parseINR(e.target.value);
              onChangeBudget(parsed ?? Number.NaN);
            }}
            className={['budget-step-input-6'].join(' ')}
          />
        </div>
      </div>

      {errors.totalBudget && (
        <p id="budget-error" className="wizard-field-error">
          Enter a valid budget from ₹0 to ₹100 crore.
        </p>
      )}
      <div>
        <span className={['budget-step-span-7'].join(' ')}>
          Or select a popular {eventType} budget tier:
        </span>

        <div className={['budget-step-div-8'].join(' ')}>
          {presets.map((preset) => {
            const isSelected = totalBudget === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChangeBudget(preset.value);
                }}
                className={[
                  'budget-step-button-9',
                  isSelected ? 'budget-step-button-9-border-yes' : 'budget-step-button-9-border-no',
                  isSelected
                    ? 'budget-step-button-9-background-yes'
                    : 'budget-step-button-9-background-no',
                  isSelected
                    ? 'budget-step-button-9-boxshadow-yes'
                    : 'budget-step-button-9-boxshadow-no',
                ].join(' ')}
              >
                <span
                  className={[
                    'budget-step-span-10',
                    isSelected ? 'budget-step-span-10-color-yes' : 'budget-step-span-10-color-no',
                  ].join(' ')}
                >
                  {formatINR(preset.value)}
                </span>
                <span className={['budget-step-span-11'].join(' ')}>
                  {preset.label.replace(/^₹[\d,]+\s*/, '')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
