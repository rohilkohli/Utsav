import { memo } from 'react';
import type { BudgetCategory } from '@shared/schemas';
import { formatINR, parseINR } from '@shared/currency';
export const BudgetRow = memo(function BudgetRow({
  category,
  totalBudget,
  onAllocate,
  onUpdate,
  onPrioritize,
}: {
  category: BudgetCategory;
  totalBudget: number;
  onAllocate: (id: string, amount: number) => void;
  onUpdate: (id: string, fields: Partial<BudgetCategory>) => void;
  onPrioritize: (id: string, priority: boolean) => void;
}) {
  const over = category.actual > category.amount;
  return (
    <section className="dashboard-card dashboard-category">
      <h3>{category.category}</h3>
      {category.subEvent && <p className="dashboard-muted">{category.subEvent}</p>}
      <p>
        {category.suggestedPercent}% suggested ·{' '}
        {category.verified ? 'Verified quotation' : 'Estimated cost'}
      </p>
      <div className="dashboard-label">
        <span>Allocation for {category.category}</span>
        <input
          aria-label={`Allocation slider for ${category.category}`}
          type="range"
          min={0}
          max={totalBudget}
          value={category.amount}
          disabled={category.locked}
          onChange={(e) => {
            onAllocate(category.id, Number(e.target.value));
          }}
        />
        <input
          className="dashboard-input"
          aria-label={`Allocated amount for ${category.category}`}
          type="number"
          min={0}
          max={totalBudget}
          value={category.amount}
          disabled={category.locked}
          onChange={(e) => {
            onAllocate(category.id, Number(e.target.value));
          }}
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={category.locked ?? false}
          onChange={(e) => {
            onUpdate(category.id, { locked: e.target.checked });
          }}
        />{' '}
        Lock {category.category}
      </label>
      <label>
        <input
          type="checkbox"
          checked={category.priority ?? false}
          disabled={category.locked}
          onChange={(event) => {
            onPrioritize(category.id, event.target.checked);
          }}
        />{' '}
        Prioritize {category.category}
      </label>
      <label className="dashboard-label">
        Actual spend for {category.category}
        <input
          className="dashboard-input"
          type="text"
          value={formatINR(category.actual)}
          onChange={(e) => {
            const value = parseINR(e.target.value);
            if (value !== null) onUpdate(category.id, { actual: value, verified: false });
          }}
        />
      </label>
      <p className={over ? 'dashboard-warning' : 'dashboard-muted'}>
        {over ? `${formatINR(category.actual - category.amount)} Over` : 'On Budget'}
      </p>
    </section>
  );
});
