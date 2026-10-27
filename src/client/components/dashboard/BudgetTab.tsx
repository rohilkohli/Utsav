import React from 'react';
import type { BudgetCategory } from '@shared/schemas';
import { calculateBudgetTotals, applyBudgetCut, groupCategoriesBySubEvent } from '@shared/budget';
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
    const updated = categories.map((c) => (c.id === id ? { ...c, actual: newActual } : c));
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
                Your actual planned spend exceeds your target budget by{' '}
                {formatINR(totals.overBudgetAmount)}.
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
            {totals.difference > 0
              ? `+${formatINR(totals.difference)}`
              : formatINR(totals.difference)}
          </span>
        </div>
      </div>

      {/* Visual Budget Distribution Bar */}
      <div style={{
        background: 'var(--surface-card)',
        padding: '1.25rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📊 Budget Distribution</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {categories.length} categories · Gemini-suggested percentages
          </span>
        </div>
        {/* Stacked bar */}
        <div style={{
          height: '22px',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          display: 'flex',
          marginBottom: '0.75rem',
          border: '1px solid var(--surface-border)',
        }}>
          {categories.map((cat, idx) => {
            const pct = totalBudget > 0 ? (cat.amount / totalBudget) * 100 : 0;
            // Cycle through a palette
            const colors = [
              'var(--primary-saffron)', 'var(--primary-magenta)', 'var(--primary-emerald)',
              'var(--primary-gold)', '#7c3aed', '#0891b2', '#dc2626', '#16a34a',
            ];
            return (
              <div
                key={cat.id}
                title={`${cat.category}: ${cat.suggestedPercent}% · ${formatINR(cat.amount)}`}
                style={{
                  width: `${pct}%`,
                  background: colors[idx % colors.length],
                  transition: 'width 0.4s ease',
                  minWidth: pct > 0.5 ? '2px' : '0',
                }}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem' }}>
          {categories.map((cat, idx) => {
            const colors = [
              'var(--primary-saffron)', 'var(--primary-magenta)', 'var(--primary-emerald)',
              'var(--primary-gold)', '#7c3aed', '#0891b2', '#dc2626', '#16a34a',
            ];
            return (
              <span key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: colors[idx % colors.length], flexShrink: 0, display: 'inline-block' }} />
                {cat.category} ({cat.suggestedPercent}%)
              </span>
            );
          })}
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
            ✂️ Quick Budget Cut
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Instantly reduce total budget — all categories re-balance to the exact rupee using Largest-Remainder math. No AI, no drift.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { pct: 10, label: 'Cut 10%', primary: false },
            { pct: 20, label: 'Cut 20% ⭐', primary: true },
            { pct: 30, label: 'Cut 30%', primary: false },
          ].map(({ pct, label, primary }) => (
            <button
              key={pct}
              type="button"
              onClick={() => handleQuickCut(pct)}
              title={`Reduce total budget by ${pct}% — from ${formatINR(totalBudget)} to ${formatINR(Math.round(totalBudget * (1 - pct / 100)))}`}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary-saffron)',
                background: primary ? 'var(--primary-saffron)' : 'transparent',
                color: primary ? '#ffffff' : 'var(--primary-saffron)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
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
                          {cat.subEvent && (
                            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, color: 'var(--primary-magenta)', marginTop: '0.1rem' }}>
                              {cat.subEvent}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '60px', height: '6px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(0,0,0,0.08)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, cat.suggestedPercent)}%`,
                                background: 'linear-gradient(90deg, var(--primary-saffron), var(--primary-magenta))',
                                borderRadius: 'var(--radius-full)',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '34px' }}>
                              {cat.suggestedPercent}%
                            </span>
                          </div>
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
