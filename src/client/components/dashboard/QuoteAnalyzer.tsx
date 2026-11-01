import React, { useMemo, useState } from 'react';
import { formatINR, parseINR } from '@shared/currency';
import { inquiryDraft, missingFields, riskFlags, type VendorQuote } from '@shared/quotes';

interface QuoteAnalyzerProps {
  vendorId: string;
  vendorName: string;
  category: string;
  budgetedAmount: number;
  onAccept: (amount: number) => void;
}

interface ExtractedQuote {
  amount: number;
  pricePerPlate?: number;
  guestMinimum?: number;
  advancePercent?: number;
  taxIncluded?: boolean;
  cancellationPolicy?: string;
  overtimeFee?: string;
}

function extractQuote(text: string): ExtractedQuote | null {
  const amounts = [...text.matchAll(/(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr|k)?/gi)]
    .map((match) => parseINR(`${match[1]}${match[2] ?? ''}`))
    .filter((amount): amount is number => amount !== null);
  if (amounts.length === 0) return null;
  const perPlateMatch = text.match(/(?:per\s*plate|plate)[^\d₹]{0,8}(?:₹|rs\.?\s*)?([\d,]+)/i);
  const minimumMatch = text.match(/(?:minimum|min)\s*(?:of\s*)?(\d[\d,]*)\s*(?:plates|guests)?/i);
  const advanceMatch = text.match(/advance[^\d]*(\d{1,3})\s*%/i);
  const cancellation = text.match(/(cancell?ation[^.\n]*)/i)?.[1];
  const overtime = text.match(/(overtime[^.\n]*)/i)?.[1];
  return {
    amount: amounts[0] ?? 0,
    ...(perPlateMatch?.[1] ? { pricePerPlate: parseINR(perPlateMatch[1]) ?? undefined } : {}),
    ...(minimumMatch?.[1] ? { guestMinimum: Number(minimumMatch[1].replace(/,/g, '')) } : {}),
    ...(advanceMatch?.[1] ? { advancePercent: Number(advanceMatch[1]) } : {}),
    ...(cancellation ? { cancellationPolicy: cancellation } : {}),
    ...(overtime ? { overtimeFee: overtime } : {}),
    ...(text.match(/gst|tax\s*included|inclusive/i) ? { taxIncluded: true } : {}),
  };
}

export const QuoteAnalyzer: React.FC<QuoteAnalyzerProps> = ({
  vendorId,
  vendorName,
  category,
  budgetedAmount,
  onAccept,
}) => {
  const [text, setText] = useState('');
  const extracted = useMemo(() => extractQuote(text), [text]);
  if (!extracted) {
    return (
      <details className="quote-analyzer">
        <summary>Analyze WhatsApp or email quote</summary>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the vendor quote here..." rows={4} />
        <p className="quote-analyzer__hint">Include the total, per-plate amount, GST, advance, minimum plates, and cancellation terms when available.</p>
      </details>
    );
  }

  const quote: VendorQuote = {
    id: `${vendorId}-quote`,
    vendorId,
    vendorName,
    category,
    quotedAmount: extracted.amount,
    budgetedAmount,
    notes: text.slice(0, 500),
    receivedAt: new Date().toISOString(),
    ...extracted,
  };
  const risks = riskFlags(quote, extracted.guestMinimum ?? 0);
  return (
    <details className="quote-analyzer" open>
      <summary>Quote analysis</summary>
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} />
      <p><strong>Detected:</strong> {formatINR(extracted.amount)}{extracted.pricePerPlate ? ` · ${formatINR(extracted.pricePerPlate)} per plate` : ''}</p>
      <p><strong>Missing:</strong> {missingFields(quote).join(', ') || 'Nothing obvious'}</p>
      {risks.length > 0 && <p className="quote-analyzer__risks"><strong>Flags:</strong> {risks.join(', ')}</p>}
      <p className="quote-analyzer__draft">{inquiryDraft(quote, {})}</p>
      <button type="button" onClick={() => onAccept(extracted.amount)}>Accept quotation</button>
    </details>
  );
};
