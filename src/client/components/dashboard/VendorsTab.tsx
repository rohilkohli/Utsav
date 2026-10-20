import React from 'react';
import type { Vendor, VendorStatus } from '@shared/schemas';
import { formatINR, parseINR } from '@shared/currency';

interface VendorsTabProps {
  vendors: Vendor[];
  onUpdateVendor: (id: string, updates: Partial<Vendor>) => void;
}

export const VendorsTab: React.FC<VendorsTabProps> = ({
  vendors,
  onUpdateVendor,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Vendor Checklist & Questionnaires
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Track vendor status, compare quoted vs budgeted amounts, and ask essential interview questions.
          </p>
        </div>
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
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: 'var(--surface-shadow)',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
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
                    onChange={(e) => onUpdateVendor(vendor.id, { status: e.target.value as VendorStatus })}
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
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
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
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                    Key Questions to Ask:
                  </span>
                  <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {vendor.questionsToAsk.map((q, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
