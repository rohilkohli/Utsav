import type { Idea } from './schemas.js';

export function createFallbackIdeas(nextId: () => string): Idea[] {
  return [
    {
      id: nextId(),
      section: 'theme',
      title: 'Marigold Sunshine & Desi Vibe',
      description:
        'Vibrant yellow and orange florals with brass bells, earthen diyas, and festive fabric drapes.',
      estimatedCost: '₹15,000-₹30,000',
    },
    {
      id: nextId(),
      section: 'decor',
      title: 'Floral Mandap / Photobooth with Rickshaw',
      description:
        'Quirky painted auto-rickshaw photo corner decorated with marigold garlands and fairy lights.',
      estimatedCost: '₹10,000-₹25,000',
    },
    {
      id: nextId(),
      section: 'food',
      title: 'Live Chaat & Jalebi Rabri Counters',
      description:
        'Hot piping pani puri, aloo tikki, and fresh jalebi made live in front of guests.',
      estimatedCost: '₹350-₹600 per plate',
    },
    {
      id: nextId(),
      section: 'activities',
      title: 'Dhol Tasha & Antakshari Face-off',
      description:
        'Energizing beats to bring both sides together for friendly competition and dancing.',
      estimatedCost: '₹8,000-₹15,000',
    },
    {
      id: nextId(),
      section: 'returnGifts',
      title: 'Eco-Friendly Seed Paper & Mithai Boxes',
      description:
        'Handcrafted box with traditional artisanal sweets and plantable seed paper tags.',
      estimatedCost: '₹200-₹400 per guest',
    },
  ];
}
