import React from 'react';
import { compareQuote } from '@shared/quotes';
import type { Vendor } from '@shared/schemas';

interface QuoteComparisonProps {
  vendor: Vendor;
}

export const QuoteComparison: React.FC<QuoteComparisonProps> = ({ vendor }) => {
  if (vendor.quotedAmount <= 0) return null;
  const comparison = compareQuote({
    id: vendor.id,
    vendorId: vendor.id,
    vendorName: vendor.category,
    category: vendor.category,
    quotedAmount: vendor.quotedAmount,
    budgetedAmount: vendor.budgetedAmount,
    notes: '',
    receivedAt: new Date().toISOString(),
  });
  return (
    <div role="status" aria-label={`Quote comparison for ${vendor.category}`} className="quote-comparison">
      <strong>{comparison.verdict.replace('-', ' ')}</strong>
      <span> · {comparison.deltaPercent}% vs target</span>
      <p>{comparison.recommendation}</p>
    </div>
  );
};
