import { z } from 'zod';

export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const IDEA_SECTIONS = ['theme', 'decor', 'food', 'activities', 'returnGifts'] as const;
export type IdeaSection = (typeof IDEA_SECTIONS)[number];

export const OUTPUT_LANGUAGES = ['english', 'hindi'] as const;
export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

export const VENDOR_STATUSES = ['to-contact', 'quoted', 'booked'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const WEDDING_SUB_EVENTS = [
  'Roka',
  'Haldi',
  'Mehendi',
  'Sangeet',
  'Wedding Ceremony',
  'Reception',
] as const;

export const COMMUNITY_SUB_EVENTS = [
  'Pandal Setup',
  'Inauguration & Aarti',
  'Cultural Night / Garba',
  'Bhandara / Prasad',
  'Visarjan / Procession',
] as const;

/** Get current date string (YYYY-MM-DD) in Asia/Kolkata timezone */
export function getTodayInKolkata(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** Check if dateStr (YYYY-MM-DD) is >= today in Asia/Kolkata */
export function isDateOnOrAfterTodayInKolkata(dateStr: string): boolean {
  const today = getTodayInKolkata();
  return dateStr >= today;
}

// ─── Wizard Input Schema ──────────────────────────────────────
export const wizardInputSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),
    subEvents: z.array(z.string().min(1).max(100)).default([]),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .refine(isDateOnOrAfterTodayInKolkata, {
        message: 'Event date cannot be in the past (IST)',
      }),
    city: z.string().trim().min(1, 'City is required').max(100),
    guestCount: z
      .number()
      .int()
      .min(0, 'Guest count cannot be negative')
      .max(10000, 'Guest count cannot exceed 10,000'),
    totalBudget: z
      .number()
      .min(0, 'Budget cannot be negative')
      .max(1_000_000_000, 'Budget cannot exceed ₹100 Crore'),
    theme: z.string().max(300).default(''),
    dietaryPreferences: z.array(z.string().max(50)).default([]),
    culturalNotes: z.string().max(500).default(''),
    language: z.enum(OUTPUT_LANGUAGES).default('english'),
    priorities: z.array(z.string().min(1).max(100)).max(20).optional(),
  })
  .refine(
    (data) => {
      if (data.eventType === 'wedding') {
        return data.subEvents.length > 0;
      }
      return true;
    },
    {
      message: 'Weddings must include at least one ceremony/function',
      path: ['subEvents'],
    },
  );

export type WizardInput = z.infer<typeof wizardInputSchema>;
