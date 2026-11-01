import { useState } from 'react';
import type { WizardInput } from '@shared/schemas';
import { getTodayInKolkata } from '@shared/schemas';
import { parseEventDescription } from '@shared/intake';
import { apiParseIntake } from '../../lib/api';
import { useAiCall } from '../../hooks/useAiCall';
import { ThinkingTrace } from '../shared/ThinkingTrace';

interface DescribeEventProps {
  onApply: (input: WizardInput) => void;
  onInstantCreate: (input: WizardInput) => void | Promise<void>;
}

export function DescribeEvent({ onApply, onInstantCreate }: DescribeEventProps) {
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const call = useAiCall<WizardInput>();

  const parse = async () => {
    if (!description.trim()) return;
    setNotice(null);
    const input = await call.run(async (options) => {
      try {
        return await apiParseIntake(description, options);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        setNotice('Using the built-in intake parser while AI is unavailable.');
        return parseEventDescription(description, getTodayInKolkata());
      }
    });
    if (input) onApply(input);
  };

  const instant = async () => {
    if (!description.trim()) return;
    call.reset();
    setNotice('Created with the built-in planner. You can refine the plan afterwards.');
    try {
      await onInstantCreate(parseEventDescription(description, getTodayInKolkata()));
    } catch {
      setNotice('The plan could not be created. Your description is preserved; please try again.');
    }
  };

  return (
    <section className="describe-event" aria-labelledby="describe-event-title">
      <div>
        <span className="eyebrow">Quick start</span>
        <h2 id="describe-event-title">Describe your celebration</h2>
        <p>One sentence is enough. Utsav will fill the planning form for you.</p>
      </div>
      <label htmlFor="celebration-description">Your celebration description</label>
      <textarea
        id="celebration-description"
        value={description}
        maxLength={1000}
        onChange={(event) => {
          call.reset();
          setDescription(event.target.value);
        }}
        placeholder="Wedding in Jaipur, 300 guests, 25 lakh budget, Dec 15, Haldi + Sangeet, pure veg"
        rows={3}
      />
      <div className="describe-event__actions">
        <button
          type="button"
          onClick={() => {
            void parse();
          }}
          disabled={call.running || !description.trim()}
        >
          Fill from description
        </button>
        <button
          type="button"
          onClick={() => {
            void instant();
          }}
          disabled={!description.trim()}
        >
          Instant create
        </button>
        {call.running && (
          <button type="button" onClick={call.cancel}>
            Cancel
          </button>
        )}
      </div>
      <ThinkingTrace {...call} />
      {call.error && (
        <div role="status">
          <p>AI intake is unavailable. You can still use the built-in parser.</p>
          <button
            type="button"
            onClick={() => {
              onApply(parseEventDescription(description, getTodayInKolkata()));
            }}
          >
            Fill with built-in parser
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
