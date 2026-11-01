import { compareQuote, effectiveCost, riskFlags, type VendorQuote } from '@shared/quotes';
import { formatINR } from '@shared/currency';
import type { Vendor } from '@shared/schemas';
interface QuoteComparisonProps {
  vendor: Vendor;
  guestCount?: number;
  onAccept?: (quote: VendorQuote) => void;
  onRemove?: (id: string) => void;
}
export const QuoteComparison = ({
  vendor,
  guestCount = 0,
  onAccept,
  onRemove,
}: QuoteComparisonProps) => {
  const quotes = vendor.quotes?.length
    ? vendor.quotes
    : vendor.quotedAmount > 0
      ? [
          {
            id: vendor.id,
            vendorId: vendor.id,
            vendorName: vendor.category,
            category: vendor.category,
            quotedAmount: vendor.quotedAmount,
            budgetedAmount: vendor.budgetedAmount,
            notes: '',
            receivedAt: '',
          },
        ]
      : [];
  if (!quotes.length) return null;
  return (
    <section aria-label={`Quote comparison for ${vendor.category}`}>
      <h4>Compare quotations</h4>
      <div className="dashboard-quote-grid">
        {quotes.map((quote) => {
          const amount = effectiveCost(quote, guestCount);
          const comparison = compareQuote({
            ...quote,
            quotedAmount: amount,
            budgetedAmount: vendor.budgetedAmount,
          });
          return (
            <article key={quote.id} className="dashboard-card">
              <h5>{quote.vendorName}</h5>
              <p>
                <strong>{formatINR(amount)}</strong>
              </p>
              <p className="dashboard-badge">
                {comparison.verdict.replaceAll('-', ' ')} · {comparison.deltaPercent}% vs target
              </p>
              <p>{comparison.recommendation}</p>
              <p>Risk flags: {riskFlags(quote, guestCount).join(', ') || 'None'}</p>
              {vendor.acceptedQuoteId === quote.id ? (
                <p className="dashboard-success">Accepted quotation</p>
              ) : (
                onAccept && (
                  <button
                    type="button"
                    className="dashboard-button dashboard-button--primary"
                    onClick={() => {
                      onAccept(quote);
                    }}
                  >
                    Accept quotation from {quote.vendorName}
                  </button>
                )
              )}
              {onRemove && vendor.acceptedQuoteId !== quote.id && (
                <button
                  type="button"
                  className="dashboard-button"
                  onClick={() => {
                    onRemove(quote.id);
                  }}
                >
                  Remove quotation from {quote.vendorName}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
