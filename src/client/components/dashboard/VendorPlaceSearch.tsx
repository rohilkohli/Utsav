import React, { useState } from 'react';
import type { VendorSuggestion } from '../../lib/api';

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ color: '#f59e0b', fontSize: '0.8rem', letterSpacing: '1px' }}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
      <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: '0.25rem' }}>{rating.toFixed(1)}</span>
    </span>
  );
}

interface VendorPlaceSearchProps {
  suggestions: VendorSuggestion[];
  onLink: (suggestion: VendorSuggestion) => void;
}

export const VendorPlaceSearch: React.FC<VendorPlaceSearchProps> = ({ suggestions, onLink }) => (
  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
    {suggestions.map((suggestion) => <VendorResultCard key={`${suggestion.name}-${suggestion.address ?? ''}`} suggestion={suggestion} onLink={onLink} />)}
  </div>
);

const VendorResultCard: React.FC<{ suggestion: VendorSuggestion; onLink: (suggestion: VendorSuggestion) => void }> = ({ suggestion, onLink }) => {
  const [copied, setCopied] = useState(false);
  const copyPhone = () => {
    if (!suggestion.phone) return;
    void navigator.clipboard.writeText(suggestion.phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{suggestion.name}</div>
      {suggestion.rating !== undefined && <StarRating rating={suggestion.rating} />}
      {suggestion.address && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>📍 {suggestion.address}</div>}
      {suggestion.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}><span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>📞 {suggestion.phone}</span><button type="button" onClick={copyPhone} title="Copy phone number" className="vendor-copy-button">{copied ? '✓ Copied' : 'Copy'}</button></div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
        {suggestion.mapsUrl && <a href={suggestion.mapsUrl} target="_blank" rel="noopener noreferrer" className="vendor-place-link">🗺️ Open in Maps</a>}
        {suggestion.website && <a href={suggestion.website} target="_blank" rel="noopener noreferrer" className="vendor-place-link">🌐 Website</a>}
        <button type="button" onClick={() => onLink(suggestion)} title={`Use ${suggestion.name} as this vendor`} className="vendor-place-link vendor-place-link--use">+ Use This Vendor</button>
      </div>
    </div>
  );
};
