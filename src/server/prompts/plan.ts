import type { WizardInput } from '../../shared/schemas.js';

export const SYSTEM_INSTRUCTION = `You are Utsav (उत्सव), an India-first expert celebration and event planner.
Your role is strictly to help users plan Indian weddings, birthdays, and community festivals.
Refuse any requests unrelated to celebration planning.
Always provide realistic, culturally nuanced suggestions that fit Indian customs, seasonal considerations, and local city markets.
Output percentages for budgets and relative calendar days for timeline/vendor items.
Never output HTML or scripts.`;

export function buildPlanPrompt(input: WizardInput): string {
  const isHindi = input.language === 'hindi';
  const langPrompt = isHindi
    ? 'IMPORTANT: Generate all titles, descriptions, and suggestions in Hindi (using standard Devanagari script).'
    : 'Generate all titles, descriptions, and suggestions in clear, engaging English.';

  let specificContext = '';

  if (input.eventType === 'wedding') {
    const subEventsStr =
      input.subEvents.length > 0
        ? input.subEvents.join(', ')
        : 'Haldi, Mehendi, Sangeet, Wedding Ceremony, Reception';

    specificContext = `
EVENT TYPE: Indian Wedding
CEREMONIES / SUB-EVENTS TO PLAN FOR: ${subEventsStr}
REQUIREMENTS:
- For the budget, timeline, vendors, and ideas, specify the "subEvent" field when an item relates to a particular ceremony (e.g. "Haldi", "Sangeet", "Wedding Ceremony").
- Budget: Provide standard percentage allocations across ceremonies and general overheads (venue, catering, decor, photography, attire, entertainment, gifts). Suggested percentages must sum to approximately 100%.
- Timeline: Provide critical milestones as daysBeforeEvent (e.g., booking venue 180 days before, bridal shopping 90 days before, finalize sangeet choreo 30 days before, etc.).
- Vendors: Include pandit/priest, mehndi artist, makeup artist (MUA), dhol/DJ/sound, decorator, and caterer. Each vendor must include 2-4 sharp, practical questions to ask them.
- Ideas: Provide at least 5 rich, personalized ideas across: theme, decor, food, activities, returnGifts.`;
  } else if (input.eventType === 'community') {
    const subEventsStr =
      input.subEvents.length > 0
        ? input.subEvents.join(', ')
        : 'Pandal Setup, Cultural Night, Visarjan';
    specificContext = `
EVENT TYPE: Indian Community Celebration / Festival (e.g., Diwali Mela, Ganesh Utsav, Navratri Garba, Society Sports Day)
CEREMONIES / STAGES: ${subEventsStr}
REQUIREMENTS:
- Community Checklist: You MUST include official permissions in the vendor/checklist section:
  1. Police Permission & NOC
  2. Municipal / Nagar Nigam clearance
  3. Sound & Noise pollution permit (loudspeaker permission till 10 PM)
  4. Fire Safety NOC (for pandal / tent structure)
- Budget: Practical allocation for stage/pandal, sound/lights, security/volunteers, prasad/food, decorations, and waste management. Percentages must sum to ~100%.
- Ideas: Include crowd engagement, eco-friendly practices (e.g. clay idols, leaf plates), and community activities.`;
  } else {
    specificContext = `
EVENT TYPE: Birthday / Milestone Celebration
REQUIREMENTS:
- Age-appropriate celebration with creative Indian themes (e.g., Bollywood Retro, Mughal Royale, Carnival, Desi Street Party).
- Budget: Venue/home decor, catering, customized cake, entertainment/emcee, and creative return gifts. Percentages must sum to ~100%.
- Vendors: Cake baker, decorator, photographer, entertainment/host, with questions to ask and advance booking dates.
- Ideas: Engaging activities, signature welcome drinks, themed photo-op booth, and personalized return gifts.`;
  }

  const dietaryStr =
    input.dietaryPreferences.length > 0
      ? `Dietary Constraints: ${input.dietaryPreferences.join(', ')}`
      : 'Dietary Constraints: Standard options (mix of vegetarian/non-vegetarian as per city customs)';

  const culturalStr = input.culturalNotes.trim()
    ? `Cultural Traditions / Custom Notes: ${input.culturalNotes}`
    : '';

  const themeStr = input.theme.trim()
    ? `Theme / Desired Vibe: ${input.theme}`
    : 'Theme: Suggest an elegant, vibrant Indian celebratory vibe';

  return `Generate an end-to-end celebration plan for:
CITY: ${input.city}, India
GUEST COUNT: ${input.guestCount}
TARGET BUDGET: ₹${input.totalBudget} (Use percentages for line items; code calculates actual rupees)
${themeStr}
${dietaryStr}
${culturalStr}
${specificContext}

${langPrompt}

Ensure the output adheres strictly to the required schema:
1. summary: A warm, inspirational 2-3 sentence overview of the celebration vision.
2. budget: An array of items with category, suggestedPercent, and optional subEvent.
3. timeline: An array of milestones with title, description, daysBeforeEvent, and optional subEvent.
4. vendors: An array of vendor recommendations with category, questionsToAsk, bookByDaysBeforeEvent, and optional subEvent.
5. ideas: At least 5 ideas covering 'theme', 'decor', 'food', 'activities', and 'returnGifts'.`;
}

export function buildRefinePrompt(
  section: string,
  instruction: string,
  input: WizardInput,
): string {
  const isHindi = input.language === 'hindi';
  const langPrompt = isHindi
    ? 'Generate all replacement ideas in Hindi (Devanagari script).'
    : 'Generate all replacement ideas in English.';

  return `The user is planning a ${input.eventType} celebration in ${input.city}, India for ${input.guestCount} guests.
The user wants to RE-GENERATE the personalized ideas for the "${section}" section with this specific instruction:

<USER_INSTRUCTION>
${instruction.trim().slice(0, 300)}
</USER_INSTRUCTION>

${langPrompt}

Generate 3 to 5 fresh, creative ideas exclusively for the "${section}" section that directly fulfill the user's instruction.
Return the ideas matching the requested schema.`;
}
