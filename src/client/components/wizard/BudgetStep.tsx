import React from 'react';
import type { EventType } from '@shared/schemas';
import { BUDGET_PRESETS } from '@shared/budget';
import { formatINR, parseINR } from '@shared/currency';

interface BudgetStepProps {
  eventType: EventType;
  totalBudget: number;
  onChangeBudget: (budget: number) => void;
}

export const BudgetStep: React.FC<BudgetStepProps> = ({
  eventType,
  totalBudget,
  onChangeBudget,
}) => {
  const presets = BUDGET_PRESETS[eventType] || BUDGET_PRESETS.wedding;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          What is your total target budget?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Utsav will allocate realistic percentages per category using deterministic rupee math.
        </p>
      </div>

      <div>
        <label
          htmlFor="total-budget-input"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Total Budget in Indian Rupees (₹):
        </label>

        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <input
            id="total-budget-input"
            type="text"
            value={totalBudget ? formatINR(totalBudget) : ''}
            placeholder="₹0"
            onChange={(e) => {
              const parsed = parseINR(e.target.value);
              onChangeBudget(parsed);
            }}
            style={{
              width: '100%',
              padding: '0.85rem 1rem',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--primary-saffron)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--primary-saffron)',
              background: 'var(--surface-card)',
            }}
          />
        </div>
      </div>

      <div>
        <span
          style={{
            display: 'block',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          Or select a popular {eventType} budget tier:
        </span>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {presets.map((preset) => {
            const isSelected = totalBudget === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChangeBudget(preset.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected
                    ? '2px solid var(--primary-saffron)'
                    : '1px solid var(--surface-border)',
                  background: isSelected ? 'var(--surface-card-hover)' : 'var(--surface-card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isSelected
                    ? '0 0 0 1px var(--primary-saffron)'
                    : 'var(--surface-shadow)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: isSelected ? 'var(--primary-saffron)' : 'var(--text-main)',
                  }}
                >
                  {formatINR(preset.value)}
                </span>
                <span
                  style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}
                >
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
