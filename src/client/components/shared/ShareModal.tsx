import React, { useState } from 'react';
import type { WizardInput, PlanOutput } from '@shared/schemas';
import { apiCreateShare } from '../../lib/api';
import { formatINR } from '@shared/currency';

interface ShareModalProps {
  input: WizardInput;
  plan: PlanOutput;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ input, plan, isOpen, onClose }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const res = await apiCreateShare(input, plan);
      setShareUrl(res.shareUrl);
    } catch {
      // Handle error gracefully
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsAppMessage = `🎉 Here is our event celebration blueprint for our ${input.eventType.toUpperCase()} in ${input.city}!
📅 Date: ${input.eventDate}
👥 Guests: ${input.guestCount}
💰 Target Budget: ${formatINR(input.totalBudget)}

View our full budget, timeline, vendors & ideas here:
${shareUrl || window.location.href}`;

  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppMessage)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          padding: '2rem',
          maxWidth: '520px',
          width: '100%',
          boxShadow: 'var(--surface-shadow)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close share dialog"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: 'var(--text-light)',
          }}
        >
          ✕
        </button>

        <h2
          id="share-modal-title"
          style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}
        >
          Share Celebration Plan 🎉
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Create a secure, read-only link valid for 30 days. Anyone with the link can view your
          budget, timeline, vendors, and ideas.
        </p>

        {!shareUrl ? (
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background:
                'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Generating Link...' : '🔗 Create Read-Only Share Link'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Shareable link"
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--surface-border)',
                  background: 'rgba(0,0,0,0.03)',
                  fontSize: '0.9rem',
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--primary-saffron)',
                  background: copied ? 'var(--success-bg)' : 'var(--primary-saffron)',
                  color: copied ? 'var(--success-text)' : '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: '#25D366',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
              }}
            >
              <span>💬</span> Share via WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
