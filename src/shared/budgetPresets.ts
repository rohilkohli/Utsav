import type { EventType } from './schemas.js';
export interface BudgetPreset {
  label: string;
  value: number;
}
export const BUDGET_PRESETS: Record<EventType, BudgetPreset[]> = {
  birthday: [
    { label: '₹15,000 (Intimate)', value: 15_000 },
    { label: '₹35,000 (Standard)', value: 35_000 },
    { label: '₹75,000 (Grand)', value: 75_000 },
    { label: '₹1,50,000+ (Luxury)', value: 150_000 },
  ],
  community: [
    { label: '₹50,000 (Small Pandal)', value: 50_000 },
    { label: '₹1,50,000 (Society Mela)', value: 150_000 },
    { label: '₹3,00,000 (City Pandal)', value: 300_000 },
    { label: '₹5,00,000+ (Grand Mahotsav)', value: 500_000 },
  ],
  wedding: [
    { label: '₹5,00,000 (Budget Intimate)', value: 500_000 },
    { label: '₹15,00,000 (Traditional)', value: 1_500_000 },
    { label: '₹30,00,000 (Grand Celebration)', value: 3_000_000 },
    { label: '₹60,00,000+ (Royal Destination)', value: 6_000_000 },
  ],
};
