import { useState } from 'react';
import type { VendorQuote } from '@shared/quotes';
import { effectiveCost, inquiryDraft, missingFields, riskFlags } from '@shared/quotes';
import { formatINR } from '@shared/currency';
import { apiExtractQuote } from '../../lib/api';
import { useAiCall } from '../../hooks/useAiCall';
import { ThinkingTrace } from '../shared/ThinkingTrace';
interface QuoteAnalyzerProps {
  vendorId: string;
  vendorName: string;
  category: string;
  budgetedAmount: number;
  guestCount: number;
  quoteCount: number;
  onAddQuote: (quote: VendorQuote) => void;
}
export const QuoteAnalyzer = ({
  vendorId,
  vendorName,
  category,
  budgetedAmount,
  guestCount,
  quoteCount,
  onAddQuote,
}: QuoteAnalyzerProps) => {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const call = useAiCall<Awaited<ReturnType<typeof apiExtractQuote>>>();
  const extracted = call.result?.quote;
  const quote: VendorQuote | null = extracted
    ? {
        ...extracted,
        id: `${vendorId}-preview`,
        vendorId,
        vendorName: extracted.vendorName ?? vendorName,
        category,
        quotedAmount: extracted.totalPrice ?? 0,
        budgetedAmount,
        notes: text.slice(0, 500),
        receivedAt: new Date().toISOString(),
      }
    : null;
  return (
    <details className="dashboard-card">
      <summary>Analyze WhatsApp or email quote</summary>
      <label className="dashboard-label">
        Quote text for {category}
        <textarea
          className="dashboard-input dashboard-refine"
          value={text}
          maxLength={8000}
          onChange={(event) => {
            setText(event.target.value);
            call.reset();
            setFeedback('');
          }}
          placeholder="Paste the vendor quotation with prices and terms"
          rows={4}
        />
      </label>
      <button
        type="button"
        className="dashboard-button"
        disabled={!text.trim() || call.running || quoteCount >= 3}
        onClick={() => {
          void call.run((options) => apiExtractQuote(text, category, options));
        }}
      >
        Analyze quote
      </button>
      {quoteCount >= 3 && <p>Three quotes are already saved. Remove one before adding another.</p>}
      <ThinkingTrace {...call} />
      {call.error && <p role="alert">{call.error}</p>}
      {quote && (
        <div className="dashboard-stack">
          <p>
            <strong>Effective total:</strong> {formatINR(effectiveCost(quote, guestCount))} ·{' '}
            {call.result?.source === 'gemini'
              ? 'Assistant (Gemini)'
              : 'Assistant (Built-in Planner)'}
          </p>
          <dl>
            <dt>Total price</dt>
            <dd>
              {extracted?.totalPrice === null ? 'Not stated' : formatINR(quote.totalPrice ?? 0)}
            </dd>
            <dt>Per plate</dt>
            <dd>{quote.pricePerPlate == null ? 'Not stated' : formatINR(quote.pricePerPlate)}</dd>
            <dt>Minimum guests</dt>
            <dd>{quote.guestMinimum ?? 'Not stated'}</dd>
            <dt>Taxes included</dt>
            <dd>{quote.taxIncluded == null ? 'Not stated' : quote.taxIncluded ? 'Yes' : 'No'}</dd>
            <dt>Advance</dt>
            <dd>{quote.advancePercent == null ? 'Not stated' : `${quote.advancePercent}%`}</dd>
            <dt>Cancellation</dt>
            <dd>{quote.cancellationPolicy ?? 'Not stated'}</dd>
          </dl>
          <p>
            <strong>Missing:</strong> {missingFields(quote).join(', ') || 'No missing terms'}
          </p>
          <p>
            <strong>Flags:</strong> {riskFlags(quote, guestCount).join(', ') || 'No flags'}
          </p>
          <p>{inquiryDraft(quote, {})}</p>
          <div className="dashboard-row">
            <button
              type="button"
              className="dashboard-button"
              onClick={() => {
                void navigator.clipboard.writeText(inquiryDraft(quote, {})).then(
                  () => {
                    setFeedback('Follow-up copied.');
                  },
                  () => {
                    setFeedback('Copy unavailable. Select the message above to copy it.');
                  },
                );
              }}
            >
              Copy follow-up
            </button>
            <button
              type="button"
              className="dashboard-button dashboard-button--primary"
              disabled={
                quoteCount >= 3 || (quote.totalPrice == null && quote.pricePerPlate == null)
              }
              onClick={() => {
                onAddQuote({
                  ...quote,
                  id: crypto.randomUUID(),
                  quotedAmount: effectiveCost(quote, guestCount),
                });
                call.reset();
                setText('');
                setFeedback('Quotation added for comparison.');
              }}
            >
              Add to comparison
            </button>
          </div>
        </div>
      )}
      <p role="status">{feedback}</p>
    </details>
  );
};
