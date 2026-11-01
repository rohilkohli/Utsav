import { useMemo, useState } from 'react';
import type { BudgetCategory } from '@shared/schemas';
import { calculateBudgetTotals, applyBudgetCut, redistribute, resizeBudget } from '@shared/budget';
import { formatINR } from '@shared/currency';
import { BudgetRow } from './BudgetCategoryRow';
import './dashboard.css';

interface BudgetTabProps {
  categories: BudgetCategory[];
  totalBudget: number;
  guestCount: number;
  perPlate: number;
  onUpdateCategories: (updated: BudgetCategory[], newTotalBudget?: number) => void;
  onUpdateGuestCount: (guestCount: number) => void;
  onUpdatePerPlate: (perPlate: number) => void;
}

export const BudgetTab = ({
  categories,
  totalBudget,
  guestCount,
  perPlate,
  onUpdateCategories,
  onUpdateGuestCount,
  onUpdatePerPlate,
}: BudgetTabProps) => {
  const totals = useMemo(
    () => calculateBudgetTotals(categories, totalBudget),
    [categories, totalBudget],
  );
  const [changes, setChanges] = useState('');
  const cateringBudget = categories
    .filter((c) => /cater|food|prasad/i.test(c.category))
    .reduce((sum, c) => sum + c.amount, 0);
  const shortfall = Math.max(0, guestCount * perPlate - cateringBudget);
  const update = (id: string, fields: Partial<BudgetCategory>) => {
    onUpdateCategories(categories.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  };
  const allocate = (id: string, amount: number) => {
    const result = redistribute(categories, id, amount);
    onUpdateCategories(result.categories);
    setChanges(
      result.changes
        .map((c) => `${c.category} ${c.delta >= 0 ? '+' : '−'}${formatINR(Math.abs(c.delta))}`)
        .join(' · '),
    );
  };
  const prioritize = (id: string, priority: boolean) => {
    const target = categories.find((category) => category.id === id);
    if (!target) return;
    const result = redistribute(
      categories,
      id,
      Math.round(target.amount * (priority ? 1.25 : 0.8)),
    );
    onUpdateCategories(
      result.categories.map((category) =>
        category.id === id ? { ...category, priority } : category,
      ),
    );
    setChanges(
      priority ? `${target.category} is now a priority.` : `${target.category} priority removed.`,
    );
  };
  const changeTotal = (value: number) => {
    const result = resizeBudget(categories, value);
    onUpdateCategories(result.updatedCategories, result.newTotal);
    if (result.newTotal !== value)
      setChanges('The total cannot be lower than your locked allocations.');
  };
  return (
    <div className="dashboard-stack">
      {totals.isOverBudget && (
        <div role="alert" className="dashboard-card dashboard-warning">
          Over Budget Warning! Your actual planned spend exceeds your target by{' '}
          {formatINR(totals.overBudgetAmount)}.
        </div>
      )}
      <section aria-label="Budget totals" className="dashboard-grid">
        <div className="dashboard-card">
          <h2>Target Budget</h2>
          <strong>{formatINR(totalBudget)}</strong>
        </div>
        <div className="dashboard-card">
          <h2>Actual Planned Spend</h2>
          <strong>{formatINR(totals.totalActual)}</strong>
        </div>
        <div className="dashboard-card">
          <h2>Available Balance</h2>
          <strong>{formatINR(totalBudget - totals.totalActual)}</strong>
        </div>
      </section>
      <div className="dashboard-card dashboard-grid">
        <label className="dashboard-label">
          Total budget (₹)
          <input
            className="dashboard-input"
            type="number"
            min={0}
            max={1000000000}
            value={totalBudget}
            onChange={(e) => {
              changeTotal(Math.max(0, Math.round(Number(e.target.value))));
            }}
          />
        </label>
        <label className="dashboard-label">
          Guest count
          <input
            className="dashboard-input"
            type="number"
            min={0}
            max={10000}
            value={guestCount}
            onChange={(e) => {
              onUpdateGuestCount(Math.min(10000, Math.max(0, Math.round(Number(e.target.value)))));
            }}
          />
        </label>
        <label className="dashboard-label">
          Per-plate cost (₹)
          <input
            className="dashboard-input"
            type="number"
            min={0}
            value={perPlate}
            onChange={(e) => {
              onUpdatePerPlate(Math.max(0, Math.round(Number(e.target.value))));
            }}
          />
        </label>
      </div>
      <div
        role="status"
        aria-live="polite"
        className={`dashboard-card dashboard-sticky ${shortfall > 0 ? 'dashboard-warning' : ''}`}
      >
        Catering required: {formatINR(guestCount * perPlate)} · Allocated:{' '}
        {formatINR(cateringBudget)}
        {shortfall > 0 && <strong> · Catering shortfall: {formatINR(shortfall)}</strong>}
      </div>
      <div className="dashboard-card dashboard-row dashboard-between">
        <div>
          <strong>✂️ Quick Budget Cut</strong>
          <p className="dashboard-muted">
            Largest-Remainder allocation keeps every rupee accounted for.
          </p>
        </div>
        {[10, 20, 30].map((percent) => (
          <button
            type="button"
            className="dashboard-button"
            key={percent}
            onClick={() => {
              const result = applyBudgetCut(categories, totalBudget, percent);
              onUpdateCategories(result.updatedCategories, result.newTotal);
            }}
          >
            Cut {percent}%
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite">
        {changes}
      </p>
      <div className="dashboard-grid">
        {categories.map((category) => (
          <BudgetRow
            key={category.id}
            category={category}
            totalBudget={totalBudget}
            onAllocate={allocate}
            onUpdate={update}
            onPrioritize={prioritize}
          />
        ))}
      </div>
    </div>
  );
};
