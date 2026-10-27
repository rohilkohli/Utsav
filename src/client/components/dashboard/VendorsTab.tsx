import React, { useState } from 'react';
import type { Vendor, VendorStatus } from '@shared/schemas';
import { formatINR, parseINR } from '@shared/currency';
import { apiSearchVendors } from '../../lib/api';
import type { VendorSuggestion } from '../../lib/api';

interface VendorsTabProps {
  vendors: Vendor[];
  city: string;
  onUpdateVendor: (id: string, updates: Partial<Vendor>) => void;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ color: '#f59e0b', fontSize: '0.8rem', letterSpacing: '1px' }}>
      {'★'.repeat(full)}
      {half ? '½' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
      <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: '0.25rem' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function VendorResultCard({
  s,
  onLink,
}: {
  s: VendorSuggestion;
  onLink: (s: VendorSuggestion) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyPhone = () => {
    if (!s.phone) return;
    navigator.clipboard.writeText(s.phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
        {s.name}
      </div>

      {s.rating !== undefined && <StarRating rating={s.rating} />}

      {s.address && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          📍 {s.address}
        </div>
      )}

      {s.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            📞 {s.phone}
          </span>
          <button
            type="button"
            onClick={copyPhone}
            title="Copy phone number"
            style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--surface-border)',
              background: copied ? 'var(--success-bg)' : 'var(--surface-card-hover)',
              color: copied ? 'var(--success-text)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
        {s.mapsUrl && (
          <a
            href={s.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(66,133,244,0.3)',
              background: 'rgba(66,133,244,0.07)',
              color: '#4285f4',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            🗺️ Open in Maps
          </a>
        )}
        {s.website && (
          <a
            href={s.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--surface-border)',
              background: 'var(--surface-card-hover)',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            🌐 Website
          </a>
        )}
        <button
          type="button"
          onClick={() => onLink(s)}
          title={`Use ${s.name} as this vendor`}
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(230,81,0,0.3)',
            background: 'rgba(230,81,0,0.07)',
            color: 'var(--primary-saffron)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + Use This Vendor
        </button>
      </div>
    </div>
  );
}

export const VendorsTab: React.FC<VendorsTabProps> = ({ vendors, city, onUpdateVendor }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VendorSuggestion[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const booked = vendors.filter((v) => v.status === 'booked').length;
  const quoted = vendors.filter((v) => v.status === 'quoted').length;
  const toContact = vendors.filter((v) => v.status === 'to-contact').length;

  const totalBudgeted = vendors.reduce((s, v) => s + (v.budgetedAmount || 0), 0);
  const totalQuoted = vendors.reduce((s, v) => s + (v.quotedAmount || 0), 0);
  const quotedOverBudget = totalQuoted > 0 && totalQuoted > totalBudgeted;

  const handleFindVendors = async (vendor: Vendor) => {
    if (expandedId === vendor.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(vendor.id);

    // Use cached results if already fetched
    if (results[vendor.id]) return;

    setLoadingId(vendor.id);
    setErrors((prev) => ({ ...prev, [vendor.id]: '' }));

    try {
      const suggestions = await apiSearchVendors(vendor.category, city, vendor.subEvent);
      setResults((prev) => ({ ...prev, [vendor.id]: suggestions }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      setErrors((prev) => ({ ...prev, [vendor.id]: msg }));
    } finally {
      setLoadingId(null);
    }
  };

  const handleLinkVendor = (vendorId: string, suggestion: VendorSuggestion) => {
    // Pre-fill vendor name field — the user can adjust status and quoted amount themselves
    onUpdateVendor(vendorId, { name: suggestion.name });
    setExpandedId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Vendor Checklist & Questionnaires
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Track status, compare quotes, and find real local vendors via Google Maps.
          </p>
        </div>
      </div>

      {/* Booking Pipeline Overview */}
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--surface-border)',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            📋 Booking Pipeline
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'To Contact', count: toContact, color: 'var(--text-muted)', bg: 'rgba(0,0,0,0.06)' },
              { label: 'Quoted', count: quoted, color: '#b45309', bg: 'rgba(255,179,0,0.15)' },
              { label: '✓ Booked', count: booked, color: 'var(--success-text)', bg: 'var(--success-bg)' },
            ].map((stage) => (
              <div
                key={stage.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: stage.bg,
                  color: stage.color,
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{stage.count}</span>
                {stage.label}
              </div>
            ))}
          </div>
        </div>

        {/* Financial Health */}
        {totalBudgeted > 0 && (
          <div style={{ fontSize: '0.85rem', textAlign: 'right' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Budgeted:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{formatINR(totalBudgeted)}</strong>
            </div>
            {totalQuoted > 0 && (
              <div
                style={{
                  color: quotedOverBudget ? 'var(--danger-text)' : 'var(--success-text)',
                  fontWeight: 700,
                }}
              >
                {quotedOverBudget ? '⚠️' : '✅'} Quoted: {formatINR(totalQuoted)}
                {quotedOverBudget && (
                  <span
                    style={{
                      fontWeight: 400,
                      color: 'var(--text-muted)',
                      marginLeft: '0.4rem',
                    }}
                  >
                    +{formatINR(totalQuoted - totalBudgeted)} over
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Maps feature banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(66,133,244,0.07), rgba(52,168,83,0.07))',
          border: '1px solid rgba(66,133,244,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          fontSize: '0.82rem',
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>🗺️</span>
        <span>
          <strong>Real Vendor Search:</strong> Each card has a{' '}
          <strong>Find Real Vendors</strong> button — it searches Google Maps for actual{' '}
          {city} businesses matching that category, with phone numbers and ratings.
          {!city && ' Add your city in the plan to enable this feature.'}
        </span>
      </div>

      {/* City/State statutory permit notice */}
      <div
        role="note"
        style={{
          background: 'rgba(255, 179, 0, 0.08)',
          border: '1px solid rgba(255, 179, 0, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 0.95rem',
          fontSize: '0.8rem',
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span aria-hidden="true">📋</span>
        <span>
          <strong>Permit Advisory:</strong> Municipal, sound (10 PM cutoff), and police clearance
          rules vary by city and state jurisdiction. Confirm statutory requirements with your local
          municipal ward / police authority.
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {vendors.map((vendor) => {
          const isBooked = vendor.status === 'booked';
          const isQuoted = vendor.status === 'quoted';
          const isExpanded = expandedId === vendor.id;
          const isLoading = loadingId === vendor.id;
          const vendorResults = results[vendor.id];
          const vendorError = errors[vendor.id];

          return (
            <div
              key={vendor.id}
              style={{
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--surface-border)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--surface-shadow)',
              }}
            >
              <div>
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                      {vendor.category}
                    </h3>
                    {vendor.subEvent && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--primary-magenta)',
                          fontWeight: 600,
                          display: 'inline-block',
                          marginTop: '0.15rem',
                        }}
                      >
                        Ceremony: {vendor.subEvent}
                      </span>
                    )}
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={vendor.status}
                    onChange={(e) =>
                      onUpdateVendor(vendor.id, { status: e.target.value as VendorStatus })
                    }
                    aria-label={`Status for ${vendor.category}`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--surface-border)',
                      background: isBooked
                        ? 'var(--success-bg)'
                        : isQuoted
                          ? 'rgba(255, 179, 0, 0.15)'
                          : 'rgba(0,0,0,0.05)',
                      color: isBooked
                        ? 'var(--success-text)'
                        : isQuoted
                          ? 'var(--primary-saffron)'
                          : 'var(--text-muted)',
                    }}
                  >
                    <option value="to-contact">To Contact</option>
                    <option value="quoted">Quoted</option>
                    <option value="booked">✓ Booked</option>
                  </select>
                </div>

                {/* Deadlines */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '1rem',
                  }}
                >
                  <span>⏳ Book by: {vendor.bookByDaysBeforeEvent} days before</span>
                  <span>📅 ({vendor.bookByDate})</span>
                </div>

                {/* Financials: Budgeted vs Quoted */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--surface-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <span
                      style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}
                    >
                      Budgeted Target
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                      {vendor.budgetedAmount ? formatINR(vendor.budgetedAmount) : '—'}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor={`quote-${vendor.id}`}
                      style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}
                    >
                      Quoted Amount (₹)
                    </label>
                    <input
                      id={`quote-${vendor.id}`}
                      type="text"
                      placeholder="Enter quote"
                      value={vendor.quotedAmount ? formatINR(vendor.quotedAmount) : ''}
                      onChange={(e) => {
                        const parsed = parseINR(e.target.value);
                        onUpdateVendor(vendor.id, { quotedAmount: parsed });
                      }}
                      style={{
                        width: '100%',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-card)',
                      }}
                    />
                  </div>
                </div>

                {/* Questions to Ask */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      display: 'block',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Key Questions to Ask:
                  </span>
                  <ul
                    style={{
                      paddingLeft: '1.2rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.45,
                    }}
                  >
                    {vendor.questionsToAsk.map((q, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Find Real Vendors Button */}
              <button
                type="button"
                onClick={() => handleFindVendors(vendor)}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: isExpanded
                    ? '1px solid rgba(66,133,244,0.4)'
                    : '1px dashed rgba(66,133,244,0.4)',
                  background: isExpanded
                    ? 'rgba(66,133,244,0.1)'
                    : 'rgba(66,133,244,0.04)',
                  color: '#4285f4',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isLoading ? 'wait' : 'pointer',
                  transition: 'all 0.15s',
                  width: '100%',
                }}
              >
                {isLoading ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(66,133,244,0.3)',
                        borderTop: '2px solid #4285f4',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }}
                    />
                    Searching Google Maps…
                  </>
                ) : isExpanded ? (
                  '▲ Hide Vendor Suggestions'
                ) : (
                  '🗺️ Find Real Vendors Near Me'
                )}
              </button>

              {/* Results Panel */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {vendorError && (
                    <div
                      style={{
                        background: 'var(--danger-bg)',
                        color: 'var(--danger-text)',
                        border: '1px solid var(--danger-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.82rem',
                      }}
                    >
                      ⚠️{' '}
                      {vendorError.includes('GOOGLE_MAPS_API_KEY')
                        ? 'Google Maps API key not configured on this server. Add GOOGLE_MAPS_API_KEY to enable real vendor search.'
                        : vendorError}
                    </div>
                  )}

                  {vendorResults && vendorResults.length === 0 && (
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.83rem',
                        textAlign: 'center',
                        padding: '0.75rem',
                      }}
                    >
                      No results found for "{vendor.category}" in {city}. Try a different search.
                    </div>
                  )}

                  {vendorResults && vendorResults.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span style={{ color: '#4285f4', fontWeight: 700 }}>
                          {vendorResults.length} results
                        </span>{' '}
                        from Google Maps · Click <strong>+ Use This Vendor</strong> to link one.
                      </div>
                      {vendorResults.map((s, idx) => (
                        <VendorResultCard
                          key={idx}
                          s={s}
                          onLink={(suggestion) => handleLinkVendor(vendor.id, suggestion)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
