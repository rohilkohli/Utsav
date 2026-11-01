/**
 * Fallback plan generation for when Gemini API is unavailable.
 * Produces a culturally appropriate, budget-accurate plan using curated
 * default data for each supported Indian event type — no LLM call required.
 * Also used by instant local planning without network access.
 */
import type { WizardInput, PlanOutput } from './schemas.js';
import { createFallbackIdeas } from './fallbackIdeas.js';
import { createFallbackBudget } from './fallbackBudget.js';
import { computeMilestoneDate } from './timeline.js';

/**
 * Generates a graceful fallback plan when Gemini is unreachable or exhausts retries.
 * Categories are based on standard Indian event planning percentages; rupee amounts
 * are calculated using the Largest-Remainder method for exact integer totals.
 *
 * @param input - Validated wizard input (event type, city, budget, guest count, date)
 * @returns A fully enriched PlanOutput with budget, timeline, vendors, and ideas
 */
export function generateFallbackPlan(input: WizardInput): PlanOutput {
  let sequence = 0;
  const nextId = () => `preset-${input.eventType}-${++sequence}`;
  const isWedding = input.eventType === 'wedding';
  const isCommunity = input.eventType === 'community';

  const enrichedBudget = createFallbackBudget(input, nextId);

  const defaultMilestones = isWedding
    ? [
        {
          id: nextId(),
          title: 'Book Venue & Dates',
          description: 'Finalize and lock in the main venue',
          daysBeforeEvent: 120,
          date: computeMilestoneDate(input.eventDate, 120),
          subEvent: 'Wedding Ceremony',
          completed: false,
        },
        {
          id: nextId(),
          title: 'Caterer Food Tasting',
          description: 'Sample menu items and freeze counters',
          daysBeforeEvent: 60,
          date: computeMilestoneDate(input.eventDate, 60),
          subEvent: 'Wedding Ceremony',
          completed: false,
        },
        {
          id: nextId(),
          title: 'Mehendi & Sangeet Playlist',
          description: 'Confirm choreography & song list',
          daysBeforeEvent: 20,
          date: computeMilestoneDate(input.eventDate, 20),
          subEvent: 'Sangeet',
          completed: false,
        },
        {
          id: nextId(),
          title: 'Wedding Ceremony & Pheras',
          description: 'The auspicious main day',
          daysBeforeEvent: 0,
          date: input.eventDate,
          subEvent: 'Wedding Ceremony',
          completed: false,
        },
      ]
    : isCommunity
      ? [
          {
            id: nextId(),
            title: 'Apply for Police & Municipal NOC',
            description: 'Submit paperwork for sound and pandal permissions',
            daysBeforeEvent: 30,
            date: computeMilestoneDate(input.eventDate, 30),
            subEvent: 'General',
            completed: false,
          },
          {
            id: nextId(),
            title: 'Pandal Erection & Electrical Inspection',
            description: 'Set up temporary structure and fire safety checks',
            daysBeforeEvent: 3,
            date: computeMilestoneDate(input.eventDate, 3),
            subEvent: 'Pandal Setup',
            completed: false,
          },
          {
            id: nextId(),
            title: 'Festival Celebration & Mahaprasad',
            description: 'Main event day and community gathering',
            daysBeforeEvent: 0,
            date: input.eventDate,
            subEvent: 'Bhandara / Prasad',
            completed: false,
          },
        ]
      : [
          {
            id: nextId(),
            title: 'Finalize Guest List & Theme',
            description: 'Confirm expected attendees',
            daysBeforeEvent: 21,
            date: computeMilestoneDate(input.eventDate, 21),
            completed: false,
          },
          {
            id: nextId(),
            title: 'Order Custom Cake & Treats',
            description: 'Pick flavor and custom topper design',
            daysBeforeEvent: 7,
            date: computeMilestoneDate(input.eventDate, 7),
            completed: false,
          },
          {
            id: nextId(),
            title: 'Birthday Celebration Day!',
            description: 'Enjoy the party with family and friends',
            daysBeforeEvent: 0,
            date: input.eventDate,
            completed: false,
          },
        ];

  const normalizedMilestones = defaultMilestones.map((milestone, index) => {
    const previous = defaultMilestones[index - 1];
    return {
      ...milestone,
      durationDays: 3,
      dependsOn: previous ? [previous.id] : [],
      status: 'todo' as const,
    };
  });

  const defaultVendors = isCommunity
    ? [
        {
          id: nextId(),
          category: 'Municipal & Police Clearances',
          questionsToAsk: [
            'What is the sound cutoff time (10 PM)?',
            'Is a dedicated fire extinguisher setup required?',
          ],
          bookByDaysBeforeEvent: 30,
          bookByDate: computeMilestoneDate(input.eventDate, 30),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount:
            enrichedBudget.find((b) => b.category.includes('Permission'))?.amount ?? 0,
          subEvent: 'General',
        },
        {
          id: nextId(),
          category: 'Pandal & Tent Contractor',
          questionsToAsk: ['Are waterproof materials used?', 'Are emergency exits planned?'],
          bookByDaysBeforeEvent: 20,
          bookByDate: computeMilestoneDate(input.eventDate, 20),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount: enrichedBudget.find((b) => b.category.includes('Pandal'))?.amount ?? 0,
          subEvent: 'Pandal Setup',
        },
      ]
    : [
        {
          id: nextId(),
          category: 'Catering & Live Counters',
          questionsToAsk: ['Do you provide live counters?', 'What is your staff-to-guest ratio?'],
          bookByDaysBeforeEvent: 45,
          bookByDate: computeMilestoneDate(input.eventDate, 45),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount:
            enrichedBudget.find(
              (b) => b.category.includes('Catering') || b.category.includes('Food'),
            )?.amount ?? 0,
        },
        {
          id: nextId(),
          category: 'Floral & Thematic Decorator',
          questionsToAsk: ['Can we do a mockup preview?', 'Are real or artificial flowers used?'],
          bookByDaysBeforeEvent: 30,
          bookByDate: computeMilestoneDate(input.eventDate, 30),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount: enrichedBudget.find((b) => b.category.includes('Decor'))?.amount ?? 0,
        },
      ];

  const defaultIdeas = createFallbackIdeas(nextId);

  return {
    summary: `A vibrant ${input.eventType} celebration designed for ${input.guestCount} guests in ${input.city}, bringing memorable cultural hospitality within your ₹${input.totalBudget.toLocaleString('en-IN')} budget.`,
    budget: enrichedBudget,
    timeline: normalizedMilestones,
    vendors: defaultVendors,
    ideas: defaultIdeas,
  };
}
