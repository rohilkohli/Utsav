import { useState } from 'react';
import type { VendorSuggestion } from '../../lib/api';
interface VendorPlaceSearchProps {
  suggestions: VendorSuggestion[];
  onLink: (suggestion: VendorSuggestion) => void;
}
export const VendorPlaceSearch = ({ suggestions, onLink }: VendorPlaceSearchProps) => (
  <div className="dashboard-grid">
    {suggestions.map((suggestion) => (
      <VendorResultCard
        key={`${suggestion.name}-${suggestion.address ?? ''}`}
        suggestion={suggestion}
        onLink={onLink}
      />
    ))}
  </div>
);
function VendorResultCard({
  suggestion,
  onLink,
}: {
  suggestion: VendorSuggestion;
  onLink: (suggestion: VendorSuggestion) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const copyPhone = () => {
    if (suggestion.phone)
      void navigator.clipboard.writeText(suggestion.phone).then(
        () => {
          setFeedback('Phone copied.');
        },
        () => {
          setFeedback('Copy unavailable. Select the phone number to copy it.');
        },
      );
  };
  return (
    <article className="dashboard-card">
      <h4>{suggestion.name}</h4>
      {suggestion.rating !== undefined && <p>Rating: {suggestion.rating.toFixed(1)} of 5</p>}
      {suggestion.address && <p>{suggestion.address}</p>}
      {suggestion.phone && (
        <p>
          {suggestion.phone}{' '}
          <button type="button" className="dashboard-button" onClick={copyPhone}>
            Copy phone
          </button>
        </p>
      )}
      <div className="dashboard-row">
        {suggestion.mapsUrl && (
          <a
            className="dashboard-button"
            href={suggestion.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Maps<span className="sr-only"> (opens in new tab)</span>
          </a>
        )}
        {suggestion.website && (
          <a
            className="dashboard-button"
            href={suggestion.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Website<span className="sr-only"> (opens in new tab)</span>
          </a>
        )}
        <button
          type="button"
          className="dashboard-button"
          onClick={() => {
            onLink(suggestion);
          }}
        >
          Use This Vendor
        </button>
      </div>
      <p role="status">{feedback}</p>
    </article>
  );
}
