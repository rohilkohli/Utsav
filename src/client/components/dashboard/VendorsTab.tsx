import { memo, useState } from 'react';
import type { Vendor, VendorStatus } from '@shared/schemas';
import { formatINR, parseINR } from '@shared/currency';
import type { VendorQuote } from '@shared/quotes';
import { apiSearchVendors } from '../../lib/api';
import type { VendorSuggestion } from '../../lib/api';
import { QuoteAnalyzer } from './QuoteAnalyzer';
import { QuoteComparison } from './QuoteComparison';
import { VendorPlaceSearch } from './VendorPlaceSearch';
import './dashboard.css';
interface VendorsTabProps {
  vendors: Vendor[];
  city: string;
  guestCount?: number;
  onUpdateVendor: (id: string, updates: Partial<Vendor>) => void;
  onAcceptQuotation?: (id: string, quote: VendorQuote) => void;
}
export const VendorsTab = ({
  vendors,
  city,
  guestCount = 0,
  onUpdateVendor,
  onAcceptQuotation,
}: VendorsTabProps) => {
  const booked = vendors.filter((v) => v.status === 'booked').length;
  return (
    <div className="dashboard-stack">
      <section className="dashboard-card">
        <h2>Vendor Checklist & Questionnaires</h2>
        <p>
          {booked} booked · {vendors.filter((v) => v.status === 'quoted').length} quoted ·{' '}
          {vendors.filter((v) => v.status === 'to-contact').length} to contact
        </p>
        <p className="dashboard-muted">
          Compare up to three quotations per category. Accepting a quotation updates your budget and
          assistant immediately.
        </p>
      </section>
      {vendors.map((vendor) => (
        <VendorCard
          key={vendor.id}
          vendor={vendor}
          city={city}
          guestCount={guestCount}
          onUpdate={(updates) => {
            onUpdateVendor(vendor.id, updates);
          }}
          onAccept={(quote) => onAcceptQuotation?.(vendor.id, quote)}
        />
      ))}
    </div>
  );
};
const VendorCard = memo(function VendorCard({
  vendor,
  city,
  guestCount,
  onUpdate,
  onAccept,
}: {
  vendor: Vendor;
  city: string;
  guestCount: number;
  onUpdate: (updates: Partial<Vendor>) => void;
  onAccept: (quote: VendorQuote) => void;
}) {
  const [results, setResults] = useState<VendorSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState('');
  const search = async () => {
    setSearchOpen(true);
    setSearching(true);
    setError('');
    try {
      setResults(await apiSearchVendors(vendor.category, city, vendor.subEvent));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vendor search unavailable');
    } finally {
      setSearching(false);
    }
  };
  return (
    <article className="dashboard-card dashboard-stack">
      <header>
        <h3>{vendor.category}</h3>
        {vendor.businessName && <p>Selected business: {vendor.businessName}</p>}
        {vendor.subEvent && <p>{vendor.subEvent}</p>}
        <p>
          Book by {vendor.bookByDate} · Budgeted: {formatINR(vendor.budgetedAmount)}
        </p>
      </header>
      <div className="dashboard-grid">
        <label className="dashboard-label">
          Status for {vendor.category}
          <select
            className="dashboard-input"
            value={vendor.status}
            onChange={(e) => {
              onUpdate({ status: e.target.value as VendorStatus });
            }}
          >
            <option value="to-contact">To Contact</option>
            <option value="quoted">Quoted</option>
            <option value="booked">Booked</option>
          </select>
        </label>
        <label className="dashboard-label">
          Quoted amount for {vendor.category}
          <input
            className="dashboard-input"
            type="text"
            value={formatINR(vendor.quotedAmount)}
            onChange={(e) => {
              const amount = parseINR(e.target.value);
              if (amount !== null)
                onUpdate({
                  quotedAmount: amount,
                  acceptedQuoteId: undefined,
                  status: amount > 0 ? 'quoted' : 'to-contact',
                });
            }}
          />
        </label>
      </div>
      <details open>
        <summary>Questions to ask {vendor.category}</summary>
        <ul>
          {vendor.questionsToAsk.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </details>
      <QuoteAnalyzer
        vendorId={vendor.id}
        vendorName={vendor.businessName ?? vendor.category}
        category={vendor.category}
        budgetedAmount={vendor.budgetedAmount}
        guestCount={guestCount}
        quoteCount={vendor.quotes?.length ?? 0}
        onAddQuote={(quote) => {
          onUpdate({
            quotes: [...(vendor.quotes ?? []), quote].slice(0, 3),
            status: vendor.status === 'booked' ? 'booked' : 'quoted',
          });
        }}
      />
      <QuoteComparison
        vendor={vendor}
        guestCount={guestCount}
        onAccept={onAccept}
        onRemove={(id) => {
          onUpdate({ quotes: vendor.quotes?.filter((quote) => quote.id !== id) });
        }}
      />
      <div>
        <button
          type="button"
          className="dashboard-button"
          disabled={searching}
          onClick={() => {
            void search();
          }}
        >
          {searching ? 'Searching…' : 'Find Real Vendors'}
        </button>
        {searchOpen && (
          <button
            type="button"
            className="dashboard-button"
            onClick={() => {
              setSearchOpen(false);
            }}
          >
            Close vendor results
          </button>
        )}
      </div>
      {searchOpen && (
        <section aria-label={`Real vendors for ${vendor.category}`}>
          <p role="status">
            {error || (!searching && results.length === 0 ? 'No matching businesses found.' : '')}
          </p>
          <VendorPlaceSearch
            suggestions={results}
            onLink={(suggestion) => {
              onUpdate({ businessName: suggestion.name });
              setSearchOpen(false);
            }}
          />
        </section>
      )}
    </article>
  );
});
