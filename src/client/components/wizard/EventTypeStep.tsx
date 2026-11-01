import type { FieldErrors } from './useWizardForm';
import './EventTypeStep.css';
import React from 'react';
import type { EventType } from '@shared/schemas';
import { WEDDING_SUB_EVENTS, COMMUNITY_SUB_EVENTS } from '@shared/schemas';

interface EventTypeStepProps {
  errors?: FieldErrors;
  eventType: EventType;
  subEvents: string[];
  onChangeType: (type: EventType) => void;
  onToggleSubEvent: (subEvent: string) => void;
}

export const EventTypeStep: React.FC<EventTypeStepProps> = ({
  eventType,
  subEvents,
  onChangeType,
  onToggleSubEvent,
  errors = {},
}) => {
  const options: {
    type: EventType;
    icon: string;
    title: string;
    subtitle: string;
    popularSubEvents?: readonly string[];
  }[] = [
    {
      type: 'wedding',
      icon: '💍',
      title: 'Indian Wedding',
      subtitle: 'Multi-day celebrations with Haldi, Mehendi, Sangeet, Pheras & Reception.',
      popularSubEvents: WEDDING_SUB_EVENTS,
    },
    {
      type: 'birthday',
      icon: '🎂',
      title: 'Birthday / Milestone',
      subtitle: 'Memorable birthday parties, 1st birthdays, sweet 16s, and milestone jubilees.',
    },
    {
      type: 'community',
      icon: '🪔',
      title: 'Community Festival',
      subtitle: 'Society Diwali melas, Ganesh pandals, Navratri garba, and cultural gatherings.',
      popularSubEvents: COMMUNITY_SUB_EVENTS,
    },
  ];

  return (
    <div>
      <h2 className={['event-type-step-h2-1'].join(' ')}>What are you celebrating?</h2>
      <p className={['event-type-step-p-2'].join(' ')}>
        Select your celebration type to customize functions, budgets, and permits.
      </p>

      <div
        id="event-ceremonies"
        tabIndex={-1}
        aria-invalid={Boolean(errors.subEvents)}
        aria-describedby={errors.subEvents ? 'event-ceremonies-error' : undefined}
        role="radiogroup"
        aria-label="Event Type"
        className={['event-type-step-div-3'].join(' ')}
      >
        {options.map((opt) => {
          const isSelected = eventType === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                onChangeType(opt.type);
              }}
              className={[
                'event-type-step-button-4',
                isSelected
                  ? 'event-type-step-button-4-border-yes'
                  : 'event-type-step-button-4-border-no',
                isSelected
                  ? 'event-type-step-button-4-background-yes'
                  : 'event-type-step-button-4-background-no',
                isSelected
                  ? 'event-type-step-button-4-boxshadow-yes'
                  : 'event-type-step-button-4-boxshadow-no',
              ].join(' ')}
            >
              <span className={['event-type-step-span-5'].join(' ')}>{opt.icon}</span>
              <span className={['event-type-step-span-6'].join(' ')}>{opt.title}</span>
              <span className={['event-type-step-span-7'].join(' ')}>{opt.subtitle}</span>
            </button>
          );
        })}
      </div>

      {errors.subEvents && (
        <p id="event-ceremonies-error" className="wizard-field-error">
          {errors.subEvents}
        </p>
      )}
      {eventType === 'wedding' && (
        <div className={['event-type-step-div-8'].join(' ')}>
          <div className={['event-type-step-div-9'].join(' ')}>
            <h3 className={['event-type-step-h3-10'].join(' ')}>
              Select Wedding Functions & Ceremonies:
            </h3>
            <p className={['event-type-step-p-11'].join(' ')}>
              Each ceremony will receive dedicated timeline milestones, vendors, and budget
              breakdowns.
            </p>
          </div>

          <div className={['event-type-step-div-12'].join(' ')}>
            {WEDDING_SUB_EVENTS.map((subEvent) => {
              const active = subEvents.includes(subEvent);
              return (
                <button
                  key={subEvent}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onToggleSubEvent(subEvent);
                  }}
                  className={[
                    'event-type-step-button-13',
                    active
                      ? 'event-type-step-button-13-border-yes'
                      : 'event-type-step-button-13-border-no',
                    active
                      ? 'event-type-step-button-13-background-yes'
                      : 'event-type-step-button-13-background-no',
                    active
                      ? 'event-type-step-button-13-color-yes'
                      : 'event-type-step-button-13-color-no',
                  ].join(' ')}
                >
                  {active ? '✓ ' : '+ '}
                  {subEvent}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {eventType === 'community' && (
        <div className={['event-type-step-div-14'].join(' ')}>
          <div className={['event-type-step-div-15'].join(' ')}>
            <h3 className={['event-type-step-h3-16'].join(' ')}>
              Select Festival Stages & Events:
            </h3>
            <p className={['event-type-step-p-17'].join(' ')}>
              Permissions checklist (Police, Sound, Municipal NOC) will be automatically included.
            </p>
          </div>

          <div className={['event-type-step-div-18'].join(' ')}>
            {COMMUNITY_SUB_EVENTS.map((subEvent) => {
              const active = subEvents.includes(subEvent);
              return (
                <button
                  key={subEvent}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onToggleSubEvent(subEvent);
                  }}
                  className={[
                    'event-type-step-button-19',
                    active
                      ? 'event-type-step-button-19-border-yes'
                      : 'event-type-step-button-19-border-no',
                    active
                      ? 'event-type-step-button-19-background-yes'
                      : 'event-type-step-button-19-background-no',
                    active
                      ? 'event-type-step-button-19-color-yes'
                      : 'event-type-step-button-19-color-no',
                  ].join(' ')}
                >
                  {active ? '✓ ' : '+ '}
                  {subEvent}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
