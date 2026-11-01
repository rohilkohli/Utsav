import type { WizardInput } from './schemas.js';
import { ensureContingencyCategory, populateCategoryAmounts } from './budget.js';

export function createFallbackBudget(input: WizardInput, nextId: () => string) {
  const isWedding = input.eventType === 'wedding';
  const isCommunity = input.eventType === 'community';
  const defaultCategories = isWedding
    ? [
        {
          id: nextId(),
          category: 'Venue & Staging',
          suggestedPercent: 30,
          subEvent: 'Wedding Ceremony',
        },
        {
          id: nextId(),
          category: 'Catering & Beverages',
          suggestedPercent: 30,
          subEvent: 'Wedding Ceremony',
        },
        {
          id: nextId(),
          category: 'Decor & Floral Mandap',
          suggestedPercent: 15,
          subEvent: 'Wedding Ceremony',
        },
        {
          id: nextId(),
          category: 'Photography & Videography',
          suggestedPercent: 10,
          subEvent: 'General',
        },
        {
          id: nextId(),
          category: 'Bridal & Groom Attire / Jewellery',
          suggestedPercent: 10,
          subEvent: 'General',
        },
        {
          id: nextId(),
          category: 'Sound, DJ & Entertainment',
          suggestedPercent: 5,
          subEvent: 'Sangeet',
        },
      ]
    : isCommunity
      ? [
          {
            id: nextId(),
            category: 'Pandal & Stage Setup',
            suggestedPercent: 35,
            subEvent: 'Pandal Setup',
          },
          {
            id: nextId(),
            category: 'Sound, Lighting & Permissions',
            suggestedPercent: 20,
            subEvent: 'General',
          },
          {
            id: nextId(),
            category: 'Bhandara / Prasad Catering',
            suggestedPercent: 25,
            subEvent: 'Bhandara / Prasad',
          },
          {
            id: nextId(),
            category: 'Cultural Artists & Emcee',
            suggestedPercent: 10,
            subEvent: 'Cultural Night / Garba',
          },
          {
            id: nextId(),
            category: 'Security, Sanitization & Waste',
            suggestedPercent: 10,
            subEvent: 'General',
          },
        ]
      : [
          { id: nextId(), category: 'Venue & Atmosphere Decor', suggestedPercent: 30 },
          { id: nextId(), category: 'Food, Snacks & Refreshments', suggestedPercent: 35 },
          { id: nextId(), category: 'Custom Cake & Confections', suggestedPercent: 10 },
          { id: nextId(), category: 'Entertainment, Games & Host', suggestedPercent: 15 },
          { id: nextId(), category: 'Return Gifts & Mementos', suggestedPercent: 10 },
        ];

  return populateCategoryAmounts(
    ensureContingencyCategory(defaultCategories),
    input.totalBudget,
    input.priorities,
  );
}
