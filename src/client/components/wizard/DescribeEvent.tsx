import React, { useState } from 'react';
import type { WizardInput } from '@shared/schemas';
import { getTodayInKolkata } from '@shared/schemas';
import { parseEventDescription } from '@shared/intake';
import { apiParseIntake } from '../../lib/api';

interface DescribeEventProps {
  onApply: (input: WizardInput) => void;
  onInstantCreate: (input: WizardInput) => void;
}

export const DescribeEvent: React.FC<DescribeEventProps> = ({ onApply, onInstantCreate }) => {
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = async (instant: boolean) => {
    if (!description.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input = await apiParseIntake(description);
      if (instant) onInstantCreate(input);
      else onApply(input);
    } catch {
      const input = parseEventDescription(description, getTodayInKolkata());
      if (instant) onInstantCreate(input);
      else onApply(input);
      setError('Using the built-in intake parser while AI is unavailable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="describe-event" aria-labelledby="describe-event-title">
      <div>
        <span className="eyebrow">Quick start</span>
        <h2 id="describe-event-title">Describe your celebration</h2>
        <p>One sentence is enough. Utsav will fill the planning form for you.</p>
      </div>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Wedding in Jaipur, 300 guests, 25 lakh budget, Dec 15, Haldi + Sangeet, pure veg"
        rows={3}
      />
      <div className="describe-event__actions">
        <button type="button" onClick={() => void parse(false)} disabled={busy}>Fill from description</button>
        <button type="button" onClick={() => void parse(true)} disabled={busy}>Instant create</button>
      </div>
      {error && <p role="status">{error}</p>}
    </section>
  );
};