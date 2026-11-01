import type { FieldErrors } from './useWizardForm';
import './EventDetailsStep.css';
import React from 'react';
import { getTodayInKolkata } from '@shared/schemas';

interface EventDetailsStepProps {
  errors?: FieldErrors;
  eventDate: string;
  city: string;
  guestCount: number;
  onChangeDate: (date: string) => void;
  onChangeCity: (city: string) => void;
  onChangeGuests: (count: number) => void;
}

const POPULAR_CITIES = [
  'Mumbai',
  'Delhi NCR',
  'Bengaluru',
  'Jaipur',
  'Ahmedabad',
  'Hyderabad',
  'Kolkata',
  'Pune',
  'Goa',
  'Lucknow',
];

export const EventDetailsStep: React.FC<EventDetailsStepProps> = ({
  eventDate,
  city,
  guestCount,
  onChangeDate,
  onChangeCity,
  onChangeGuests,
  errors = {},
}) => {
  const minDate = getTodayInKolkata();

  return (
    <div className={['event-details-step-div-1'].join(' ')}>
      <div>
        <h2 className={['event-details-step-h2-2'].join(' ')}>
          When and where is the celebration?
        </h2>
        <p className={['event-details-step-p-3'].join(' ')}>
          Provide the event date, Indian host city, and expected guest count.
        </p>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="event-date" className={['event-details-step-label-4'].join(' ')}>
          Event Date (YYYY-MM-DD):
        </label>
        <input
          id="event-date"
          aria-invalid={Boolean(errors.eventDate)}
          aria-describedby={
            errors.eventDate ? 'event-date-help event-date-error' : 'event-date-help'
          }
          type="date"
          min={minDate}
          value={eventDate}
          onChange={(e) => {
            onChangeDate(e.target.value);
          }}
          required
          className={['event-details-step-input-5'].join(' ')}
        />
        <span id="event-date-help" className={['event-details-step-span-6'].join(' ')}>
          Date is evaluated in Asia/Kolkata timezone.
        </span>
      </div>

      {errors.eventDate && (
        <p id="event-date-error" className="wizard-field-error">
          {errors.eventDate}
        </p>
      )}
      {/* City */}
      <div>
        <label htmlFor="event-city" className={['event-details-step-label-7'].join(' ')}>
          Host City in India:
        </label>
        <input
          id="event-city"
          aria-invalid={Boolean(errors.city)}
          aria-describedby={errors.city ? 'event-city-error' : undefined}
          type="text"
          placeholder="e.g. Jaipur, Bengaluru, Mumbai"
          value={city}
          onChange={(e) => {
            onChangeCity(e.target.value);
          }}
          required
          className={['event-details-step-input-8'].join(' ')}
        />
        <div className={['event-details-step-div-9'].join(' ')}>
          <span className={['event-details-step-span-10'].join(' ')}>Popular:</span>
          {POPULAR_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChangeCity(c);
              }}
              className={[
                'event-details-step-button-11',
                city === c
                  ? 'event-details-step-button-11-background-yes'
                  : 'event-details-step-button-11-background-no',
                city === c
                  ? 'event-details-step-button-11-color-yes'
                  : 'event-details-step-button-11-color-no',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {errors.city && (
        <p id="event-city-error" className="wizard-field-error">
          {errors.city}
        </p>
      )}
      {/* Guest Count */}
      <div>
        <div className={['event-details-step-div-12'].join(' ')}>
          <label htmlFor="guest-count" className={['event-details-step-label-13'].join(' ')}>
            Expected Guest Count:
          </label>
          <span className={['event-details-step-span-14'].join(' ')}>
            {guestCount.toLocaleString('en-IN')} guests
          </span>
        </div>

        <input
          id="guest-count"
          type="range"
          min={0}
          max={5000}
          step={guestCount > 500 ? 50 : 10}
          value={Math.min(5000, guestCount)}
          onChange={(e) => {
            onChangeGuests(parseInt(e.target.value, 10));
          }}
          className={['event-details-step-input-15'].join(' ')}
        />

        <div className={['event-details-step-div-16'].join(' ')}>
          <span className={['event-details-step-span-17'].join(' ')}>Or type exact count:</span>
          <input
            type="number"
            min={0}
            max={10000}
            value={guestCount}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onChangeGuests(isNaN(val) ? 0 : Math.min(10000, Math.max(0, val)));
            }}
            id="exact-guest-count"
            aria-label="Exact guest count"
            aria-invalid={Boolean(errors.guestCount)}
            aria-describedby={errors.guestCount ? 'guest-count-error' : undefined}
            className={['event-details-step-input-18'].join(' ')}
          />
        </div>
      </div>
      {errors.guestCount && (
        <p id="guest-count-error" className="wizard-field-error">
          {errors.guestCount}
        </p>
      )}
    </div>
  );
};
