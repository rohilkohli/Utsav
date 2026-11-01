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
  const saved = vendor.quotes ?? [];
  const manual: VendorQuote | null =
    vendor.quotedAmount > 0 && !vendor.acceptedQuoteId
      ? {
          id: vendor.id,
          vendorId: vendor.id,
          vendorName: vendor.businessName ?? vendor.category,
          category: vendor.category,
          quotedAmount: vendor.quotedAmount,
          budgetedAmount: vendor.budgetedAmount,
          notes: '',
          receivedAt: '',
        }
      : null;
  const quotes = saved.length ? saved : manual ? [manual] : [];
  if (!quotes.length) return null;
  return (
    <section aria-label={`Quote comparison for ${vendor.category}`}>
      <h4>Compare quotations</h4>
      {manual && saved.length > 0 && (
        <div
          className="dashboard-card"
          role="status"
          aria-label={`Current manual quote for ${vendor.category}`}
        >
          <h5>Current manual quotation</h5>
          <QuoteSummary
            quote={manual}
            budgetedAmount={vendor.budgetedAmount}
            guestCount={guestCount}
          />
          <p>Saved quotations below are unchanged. Accept one to restore its agreed terms.</p>
        </div>
      )}
      <div className="dashboard-quote-grid">
        {quotes.map((quote) => (
          <article key={quote.id} className="dashboard-card">
            <h5>{quote.vendorName}</h5>
            <QuoteSummary
              quote={quote}
              budgetedAmount={vendor.budgetedAmount}
              guestCount={guestCount}
            />
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
        ))}
      </div>
    </section>
  );
};
function QuoteSummary({
  quote,
  budgetedAmount,
  guestCount,
}: {
  quote: VendorQuote;
  budgetedAmount: number;
  guestCount: number;
}) {
  const amount = effectiveCost(quote, guestCount);
  const comparison = compareQuote({ ...quote, quotedAmount: amount, budgetedAmount });
  return (
    <>
      <p>
        <strong>{formatINR(amount)}</strong>
      </p>
      <p className="dashboard-badge">
        {comparison.verdict.replaceAll('-', ' ')} · {comparison.deltaPercent}% vs target
      </p>
      <p>{comparison.recommendation}</p>
      <p>Risk flags: {riskFlags({ ...quote, budgetedAmount }, guestCount).join(', ') || 'None'}</p>
    </>
  );
}
