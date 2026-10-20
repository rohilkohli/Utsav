import React from 'react';
import type { BudgetCategory } from '@shared/schemas';
import {
  calculateBudgetTotals,
  applyBudgetCut,
  groupCategoriesBySubEvent,
} from '@shared/budget';
import { formatINR, parseINR } from '@shared/currency';

interface BudgetTabProps {
  categories: BudgetCategory[];
  totalBudget: number;
  onUpdateCategories: (updated: BudgetCategory[], newTotalBudget?: number) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({
  categories,
  totalBudget,
  onUpdateCategories,
}) => {
  const totals = calculateBudgetTotals(categories, totalBudget);
  const grouped = groupCategoriesBySubEvent(categories);

  const handleActualChange = (id: string, newActual: number) => {
    const updated = categories.map((c) =>
      c.id === id ? { ...c, actual: newActual } : c
    );
    onUpdateCategories(updated);
  };

  const handleQuickCut = (percent: number) => {
    const { newTotal, updatedCategories } = applyBudgetCut(categories, totalBudget, percent);
    onUpdateCategories(updatedCategories, newTotal);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Over-Budget Alert */}
      {totals.isOverBudget && (
        <div
          role="alert"
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger-text)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <span>Over Budget Warning!</span>
              <p style={{ fontSize: '0.85rem', fontWeight: 400, marginTop: '0.1rem' }}>
                Your actual planned spend exceeds your target budget by {formatINR(totals.overBudgetAmount)}.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            +{formatINR(totals.overBudgetAmount)}
          </span>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            background: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Target Budget
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-saffron)' }}>
            {formatINR(totalBudget)}
          </span>
        </div>

        <div
          style={{
            background: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Allocated (Suggested)
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {formatINR(totals.totalBudgeted)}
          </span>
        </div>

        <div
          style={{
            background: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Actual Planned Spend
          </span>
          <span
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: totals.isOverBudget ? 'var(--danger-text)' : 'var(--success-text)',
            }}
          >
            {formatINR(totals.totalActual)}
          </span>
        </div>

        <div
          style={{
            background: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Variance
          </span>
          <span
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: totals.isOverBudget ? 'var(--danger-text)' : 'var(--success-text)',
            }}
          >
            {totals.difference > 0 ? `+${formatINR(totals.difference)}` : formatINR(totals.difference)}
          </span>
        </div>
      </div>

      {/* Deterministic "Cut Budget X%" Controls */}
      <div
        style={{
          background: 'var(--surface-card)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--surface-border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>
            Deterministic Budget Optimization (Instant TS Math)
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Cut total budget without LLM drift; items re-balance exactly via Largest-Remainder rounding.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => handleQuickCut(10)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary-saffron)',
              background: 'transparent',
              color: 'var(--primary-saffron)',
              cursor: 'pointer',
            }}
          >
            Cut 10%
          </button>
          <button
            type="button"
            onClick={() => handleQuickCut(20)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary-saffron)',
              background: 'var(--primary-saffron)',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Cut 20%
          </button>
          <button
            type="button"
            onClick={() => handleQuickCut(30)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary-saffron)',
              background: 'transparent',
              color: 'var(--primary-saffron)',
              cursor: 'pointer',
            }}
          >
            Cut 30%
          </button>
        </div>
      </div>

      {/* Budget Breakdown Table */}
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.95rem',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  borderBottom: '1px solid var(--surface-border)',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                <th style={{ padding: '0.85rem 1rem' }}>Suggested %</th>
                <th style={{ padding: '0.85rem 1rem' }}>Allocated (₹)</th>
                <th style={{ padding: '0.85rem 1rem' }}>Actual Spend (₹)</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([subEvent, items]) => (
                <React.Fragment key={subEvent}>
                  {subEvent !== 'General' && (
                    <tr style={{ background: 'rgba(230, 81, 0, 0.04)' }}>
                      <td
                        colSpan={5}
                        style={{
                          padding: '0.5rem 1rem',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: 'var(--primary-saffron)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {subEvent} Ceremony Breakdown
                      </td>
                    </tr>
                  )}
                  {items.map((cat) => {
                    const diff = cat.actual - cat.amount;
                    const isRowOver = diff > 0;
                    return (
                      <tr
                        key={cat.id}
                        style={{
                          borderBottom: '1px solid var(--surface-border)',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                          {cat.category}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                          {cat.suggestedPercent}%
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                          {formatINR(cat.amount)}
                        </td>
                        <td style={{ padding: '0.5rem 1rem' }}>
                          <input
                            type="text"
                            value={formatINR(cat.actual)}
                            onChange={(e) => {
                              const parsed = parseINR(e.target.value);
                              handleActualChange(cat.id, parsed);
                            }}
                            aria-label={`Actual spend for ${cat.category}`}
                            style={{
                              width: '130px',
                              padding: '0.45rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              border: isRowOver
                                ? '1px solid var(--danger-border)'
                                : '1px solid var(--surface-border)',
                              background: 'var(--surface-card)',
                              color: isRowOver ? 'var(--danger-text)' : 'var(--text-main)',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                            }}
                          />
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              background: isRowOver ? 'var(--danger-bg)' : 'var(--success-bg)',
                              color: isRowOver ? 'var(--danger-text)' : 'var(--success-text)',
                            }}
                          >
                            {diff === 0
                              ? 'On Budget'
                              : isRowOver
                                ? `+${formatINR(diff)} Over`
                                : `${formatINR(Math.abs(diff))} Saved`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
