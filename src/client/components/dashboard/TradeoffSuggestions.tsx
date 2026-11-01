import { useMemo } from 'react';
import type { PlanOutput } from '@shared/schemas';
import { calculateBudgetTotals, updateBudgetCategories } from '@shared/budget';
import { suggestTradeoffs } from '@shared/tradeoffs';
import { apiExplainTradeoffs } from '../../lib/api';
import { useAiCall } from '../../hooks/useAiCall';
import { ThinkingTrace } from '../shared/ThinkingTrace';
export function TradeoffSuggestions({
  plan,
  totalBudget,
  onUpdate,
}: {
  plan: PlanOutput;
  totalBudget: number;
  onUpdate: (plan: PlanOutput) => void;
}) {
  const explain = useAiCall<Awaited<ReturnType<typeof apiExplainTradeoffs>>>();
  const totals = useMemo(
    () => calculateBudgetTotals(plan.budget, totalBudget),
    [plan.budget, totalBudget],
  );
  const options = useMemo(
    () =>
      totals.isOverBudget
        ? suggestTradeoffs(plan.budget, totalBudget, totals.overBudgetAmount)
        : [],
    [plan.budget, totalBudget, totals],
  );
  const feasibleOptions = options.filter((option) => option.feasible);
  if (!options.length) return null;
  return (
    <section
      role="alert"
      aria-label="Budget tradeoff suggestions"
      className="dashboard-card dashboard-warning"
    >
      <h2>You are ₹{totals.overBudgetAmount.toLocaleString('en-IN')} over budget</h2>
      <div className="dashboard-row">
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            className="dashboard-button"
            title={option.description}
            disabled={!option.feasible}
            onClick={() => {
              onUpdate(updateBudgetCategories(plan, option.updatedCategories));
            }}
          >
            {option.label} (saves ₹{option.savings.toLocaleString('en-IN')})
            {!option.feasible && (
              <> · Uncovered shortfall: ₹{option.uncoveredShortfall.toLocaleString('en-IN')}</>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="dashboard-button"
        disabled={!feasibleOptions.length}
        onClick={() => {
          void explain.run((progress) =>
            apiExplainTradeoffs(
              totals.overBudgetAmount,
              feasibleOptions.map((option) => ({
                label: option.label,
                description: option.description,
                savings: option.savings,
                newTotal: option.newTotalActual,
              })),
              progress,
            ),
          );
        }}
      >
        Explain these options
      </button>
      <ThinkingTrace {...explain} />
      {explain.result && <p>{explain.result.explanation}</p>}
      {explain.error && <p role="status">{explain.error}</p>}
    </section>
  );
}
