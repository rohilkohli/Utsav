import './ShareModal.css';
import React, { useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
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
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await apiCreateShare(input, plan);
      setShareUrl(res.shareUrl);
    } catch {
      setError('We could not create the link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setError('Copy is unavailable. Select and copy the share link above.');
    }
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
      ref={dialogRef}
      className={['share-modal-div-1'].join(' ')}
    >
      <div className={['share-modal-div-2'].join(' ')}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close share dialog"
          className={['share-modal-button-3'].join(' ')}
        >
          ✕
        </button>

        <h2 id="share-modal-title" className={['share-modal-h2-4'].join(' ')}>
          Share Celebration Plan 🎉
        </h2>
        <p className={['share-modal-p-5'].join(' ')}>
          Create a secure, read-only link valid for 30 days. Anyone with the link can view your
          budget, timeline, vendors, and ideas.
        </p>

        {error && <p role="alert">{error}</p>}
        {copied && <p role="status">Share link copied.</p>}
        {!shareUrl ? (
          <button
            type="button"
            onClick={() => {
              void handleGenerateLink();
            }}
            disabled={isLoading}
            className={[
              'share-modal-button-6',
              isLoading ? 'share-modal-button-6-cursor-yes' : 'share-modal-button-6-cursor-no',
            ].join(' ')}
          >
            {isLoading ? 'Generating Link...' : '🔗 Create Read-Only Share Link'}
          </button>
        ) : (
          <div className={['share-modal-div-7'].join(' ')}>
            <div className={['share-modal-div-8'].join(' ')}>
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Shareable link"
                className={['share-modal-input-9'].join(' ')}
              />
              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                className={[
                  'share-modal-button-10',
                  copied
                    ? 'share-modal-button-10-background-yes'
                    : 'share-modal-button-10-background-no',
                  copied ? 'share-modal-button-10-color-yes' : 'share-modal-button-10-color-no',
                ].join(' ')}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={['share-modal-a-11'].join(' ')}
            >
              <span>💬</span> Share via WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
