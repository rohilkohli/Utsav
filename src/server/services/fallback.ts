/**
 * Fallback plan generation for when Gemini API is unavailable.
 * Produces a culturally appropriate, budget-accurate plan using curated
 * default data for each supported Indian event type — no LLM call required.
 * Used when GEMINI_API_KEY is not configured or all Gemini retries fail.
 */
import { nanoid } from 'nanoid';
import type { WizardInput, PlanOutput, Idea } from '../../shared/schemas.js';
import { populateCategoryAmounts } from '../../shared/budget.js';
import { computeMilestoneDate } from '../../shared/timeline.js';

/**
 * Generates a graceful fallback plan when Gemini is unreachable or exhausts retries.
 * Categories are based on standard Indian event planning percentages; rupee amounts
 * are calculated using the Largest-Remainder method for exact integer totals.
 *
 * @param input - Validated wizard input (event type, city, budget, guest count, date)
 * @returns A fully enriched PlanOutput with budget, timeline, vendors, and ideas
 */
export function generateFallbackPlan(input: WizardInput): PlanOutput {
  const isWedding = input.eventType === 'wedding';
  const isCommunity = input.eventType === 'community';

  const defaultCategories = isWedding
    ? [
        { id: nanoid(), category: 'Venue & Staging', suggestedPercent: 30, subEvent: 'Wedding Ceremony' },
        { id: nanoid(), category: 'Catering & Beverages', suggestedPercent: 30, subEvent: 'Wedding Ceremony' },
        { id: nanoid(), category: 'Decor & Floral Mandap', suggestedPercent: 15, subEvent: 'Wedding Ceremony' },
        { id: nanoid(), category: 'Photography & Videography', suggestedPercent: 10, subEvent: 'General' },
        { id: nanoid(), category: 'Bridal & Groom Attire / Jewellery', suggestedPercent: 10, subEvent: 'General' },
        { id: nanoid(), category: 'Sound, DJ & Entertainment', suggestedPercent: 5, subEvent: 'Sangeet' },
      ]
    : isCommunity
      ? [
          { id: nanoid(), category: 'Pandal & Stage Setup', suggestedPercent: 35, subEvent: 'Pandal Setup' },
          { id: nanoid(), category: 'Sound, Lighting & Permissions', suggestedPercent: 20, subEvent: 'General' },
          { id: nanoid(), category: 'Bhandara / Prasad Catering', suggestedPercent: 25, subEvent: 'Bhandara / Prasad' },
          { id: nanoid(), category: 'Cultural Artists & Emcee', suggestedPercent: 10, subEvent: 'Cultural Night / Garba' },
          { id: nanoid(), category: 'Security, Sanitization & Waste', suggestedPercent: 10, subEvent: 'General' },
        ]
      : [
          { id: nanoid(), category: 'Venue & Atmosphere Decor', suggestedPercent: 30 },
          { id: nanoid(), category: 'Food, Snacks & Refreshments', suggestedPercent: 35 },
          { id: nanoid(), category: 'Custom Cake & Confections', suggestedPercent: 10 },
          { id: nanoid(), category: 'Entertainment, Games & Host', suggestedPercent: 15 },
          { id: nanoid(), category: 'Return Gifts & Mementos', suggestedPercent: 10 },
        ];

  const enrichedBudget = populateCategoryAmounts(defaultCategories, input.totalBudget);

  const defaultMilestones = isWedding
    ? [
        { id: nanoid(), title: 'Book Venue & Dates', description: 'Finalize and lock in the main venue', daysBeforeEvent: 120, date: computeMilestoneDate(input.eventDate, 120), subEvent: 'Wedding Ceremony', completed: false },
        { id: nanoid(), title: 'Caterer Food Tasting', description: 'Sample menu items and freeze counters', daysBeforeEvent: 60, date: computeMilestoneDate(input.eventDate, 60), subEvent: 'Wedding Ceremony', completed: false },
        { id: nanoid(), title: 'Mehendi & Sangeet Playlist', description: 'Confirm choreography & song list', daysBeforeEvent: 20, date: computeMilestoneDate(input.eventDate, 20), subEvent: 'Sangeet', completed: false },
        { id: nanoid(), title: 'Wedding Ceremony & Pheras', description: 'The auspicious main day', daysBeforeEvent: 0, date: input.eventDate, subEvent: 'Wedding Ceremony', completed: false },
      ]
    : isCommunity
      ? [
          { id: nanoid(), title: 'Apply for Police & Municipal NOC', description: 'Submit paperwork for sound and pandal permissions', daysBeforeEvent: 30, date: computeMilestoneDate(input.eventDate, 30), subEvent: 'General', completed: false },
          { id: nanoid(), title: 'Pandal Erection & Electrical Inspection', description: 'Set up temporary structure and fire safety checks', daysBeforeEvent: 3, date: computeMilestoneDate(input.eventDate, 3), subEvent: 'Pandal Setup', completed: false },
          { id: nanoid(), title: 'Festival Celebration & Mahaprasad', description: 'Main event day and community gathering', daysBeforeEvent: 0, date: input.eventDate, subEvent: 'Bhandara / Prasad', completed: false },
        ]
      : [
          { id: nanoid(), title: 'Finalize Guest List & Theme', description: 'Confirm expected attendees', daysBeforeEvent: 21, date: computeMilestoneDate(input.eventDate, 21), completed: false },
          { id: nanoid(), title: 'Order Custom Cake & Treats', description: 'Pick flavor and custom topper design', daysBeforeEvent: 7, date: computeMilestoneDate(input.eventDate, 7), completed: false },
          { id: nanoid(), title: 'Birthday Celebration Day!', description: 'Enjoy the party with family and friends', daysBeforeEvent: 0, date: input.eventDate, completed: false },
        ];

  const defaultVendors = isCommunity
    ? [
        {
          id: nanoid(),
          category: 'Municipal & Police Clearances',
          questionsToAsk: ['What is the sound cutoff time (10 PM)?', 'Is a dedicated fire extinguisher setup required?'],
          bookByDaysBeforeEvent: 30,
          bookByDate: computeMilestoneDate(input.eventDate, 30),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount: enrichedBudget.find((b) => b.category.includes('Permission'))?.amount || 0,
          subEvent: 'General',
        },
        {
          id: nanoid(),
          category: 'Pandal & Tent Contractor',
          questionsToAsk: ['Are waterproof materials used?', 'Are emergency exits planned?'],
          bookByDaysBeforeEvent: 20,
          bookByDate: computeMilestoneDate(input.eventDate, 20),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount: enrichedBudget.find((b) => b.category.includes('Pandal'))?.amount || 0,
          subEvent: 'Pandal Setup',
        },
      ]
    : [
        {
          id: nanoid(),
          category: 'Catering & Live Counters',
          questionsToAsk: ['Do you provide live counters?', 'What is your staff-to-guest ratio?'],
          bookByDaysBeforeEvent: 45,
          bookByDate: computeMilestoneDate(input.eventDate, 45),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount: enrichedBudget.find((b) => b.category.includes('Catering') || b.category.includes('Food'))?.amount || 0,
        },
        {
          id: nanoid(),
          category: 'Floral & Thematic Decorator',
          questionsToAsk: ['Can we do a mockup preview?', 'Are real or artificial flowers used?'],
          bookByDaysBeforeEvent: 30,
          bookByDate: computeMilestoneDate(input.eventDate, 30),
          status: 'to-contact' as const,
          quotedAmount: 0,
          budgetedAmount: enrichedBudget.find((b) => b.category.includes('Decor'))?.amount || 0,
        },
      ];

  const defaultIdeas: Idea[] = [
    { id: nanoid(), section: 'theme', title: 'Marigold Sunshine & Desi Vibe', description: 'Vibrant yellow and orange florals with brass bells, earthen diyas, and festive fabric drapes.', estimatedCost: '₹15,000-₹30,000' },
    { id: nanoid(), section: 'decor', title: 'Floral Mandap / Photobooth with Rickshaw', description: 'Quirky painted auto-rickshaw photo corner decorated with marigold garlands and fairy lights.', estimatedCost: '₹10,000-₹25,000' },
    { id: nanoid(), section: 'food', title: 'Live Chaat & Jalebi Rabri Counters', description: 'Hot piping pani puri, aloo tikki, and fresh jalebi made live in front of guests.', estimatedCost: '₹350-₹600 per plate' },
    { id: nanoid(), section: 'activities', title: 'Dhol Tasha & Antakshari Face-off', description: 'Energizing beats to bring both sides together for friendly competition and dancing.', estimatedCost: '₹8,000-₹15,000' },
    { id: nanoid(), section: 'returnGifts', title: 'Eco-Friendly Seed Paper & Mithai Boxes', description: 'Handcrafted box with traditional artisanal sweets and plantable seed paper tags.', estimatedCost: '₹200-₹400 per guest' },
  ];

  return {
    summary: `A vibrant ${input.eventType} celebration designed for ${input.guestCount} guests in ${input.city}, bringing memorable cultural hospitality within your ₹${input.totalBudget.toLocaleString('en-IN')} budget.`,
    budget: enrichedBudget,
    timeline: defaultMilestones,
    vendors: defaultVendors,
    ideas: defaultIdeas,
  };
}
