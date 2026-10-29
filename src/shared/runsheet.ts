import type { EventType } from './schemas.js';

export interface RunSheetBlock {
  time: string;
  task: string;
  owner: string;
  notes?: string;
}

export interface RunSheet {
  eventLabel: string;
  blocks: RunSheetBlock[];
}

const WEDDING_RUN_SHEET: RunSheetBlock[] = [
  { time: 'T-3 days', task: 'Confirm all vendor arrival times and parking slots', owner: 'Coordinator' },
  { time: 'T-1 day', task: 'Finalize seating chart and table name cards', owner: 'Family' },
  { time: '6:00 AM', task: 'Venue walkthrough and setup start', owner: 'Decorator', notes: 'Verify mandap orientation' },
  { time: '7:00 AM', task: 'Catering team arrives — kitchen setup', owner: 'Caterer' },
  { time: '8:00 AM', task: 'Florist completes floral arrangements', owner: 'Florist' },
  { time: '9:00 AM', task: 'Bride & groom hair/makeup begins', owner: 'Makeup artist' },
  { time: '10:00 AM', task: 'Photographer & videographer briefing', owner: 'Coordinator', notes: 'Share shot list' },
  { time: '11:00 AM', task: 'Music/DJ soundcheck', owner: 'DJ / Band' },
  { time: '12:00 PM', task: 'First guests arrive — ushers in position', owner: 'Family' },
  { time: '12:30 PM', task: 'Pre-ceremony rituals (Ganesh puja / family blessings)', owner: 'Pandit' },
  { time: '1:00 PM', task: 'Wedding ceremony begins', owner: 'Pandit' },
  { time: '2:30 PM', task: 'Pheras / key ceremony moments', owner: 'Pandit', notes: 'Ensure photographer positioned' },
  { time: '3:30 PM', task: 'Wedding ceremony concludes — family photos', owner: 'Photographer' },
  { time: '4:00 PM', task: 'Lunch service begins', owner: 'Caterer' },
  { time: '5:30 PM', task: 'Guest departure — favors distribution', owner: 'Family' },
  { time: '6:00 PM', task: 'Evening reception setup begins', owner: 'Coordinator' },
  { time: '7:00 PM', task: 'Reception starts — cocktail hour', owner: 'DJ' },
  { time: '9:00 PM', task: 'Dinner service begins', owner: 'Caterer' },
  { time: '11:00 PM', task: 'Cake cutting & first dance', owner: 'Bride & groom' },
  { time: '12:00 AM', task: 'Event wrap-up — vendor payment collection', owner: 'Coordinator' },
];

const BIRTHDAY_RUN_SHEET: RunSheetBlock[] = [
  { time: 'T-1 day', task: 'Confirm cake order and delivery time', owner: 'Host' },
  { time: '1 hr before', task: 'Venue decoration begins', owner: 'Host / Decorator' },
  { time: '30 min before', task: 'Music playlist queued, photo corner set up', owner: 'Host' },
  { time: 'On arrival', task: 'Welcome guests — coordinate parking if needed', owner: 'Family' },
  { time: '+30 min', task: 'Cocktails / mocktails and snacks served', owner: 'Caterer' },
  { time: '+1 hr', task: 'Games / entertainment begins', owner: 'Host' },
  { time: '+2 hr', task: 'Main meal served', owner: 'Caterer' },
  { time: '+3 hr', task: 'Cake cutting — "Happy Birthday" song', owner: 'Host', notes: 'Ensure photographer ready' },
  { time: '+3:30 hr', task: 'Dessert served, gift opening session', owner: 'Host' },
  { time: '+4 hr', task: 'Return gifts / favors distributed to guests', owner: 'Family' },
  { time: '+4:30 hr', task: 'Wrap-up — thank guests', owner: 'Host' },
];

const COMMUNITY_RUN_SHEET: RunSheetBlock[] = [
  { time: 'T-2 days', task: 'Pandal / shamiana erection complete', owner: 'Decorator' },
  { time: 'T-1 day', task: 'Idol installation and final decoration', owner: 'Pujari / Committee' },
  { time: 'Day 1 — 6 AM', task: 'Prabhat pheri / procession', owner: 'Organizer' },
  { time: 'Day 1 — 9 AM', task: 'Inaugural puja and aarti', owner: 'Pujari' },
  { time: 'Day 1 — 11 AM', task: 'Prasad distribution starts', owner: 'Volunteers' },
  { time: 'Day 1 — 5 PM', task: 'Cultural programme — classical music / dance', owner: 'Artists' },
  { time: 'Day 1 — 8 PM', task: 'Evening aarti and bhandara', owner: 'Pujari / Caterer' },
  { time: 'Day 2 — 9 AM', task: 'Morning puja and prasad', owner: 'Pujari' },
  { time: 'Day 2 — 7 PM', task: 'Garba / Raas night begins', owner: 'DJ / Folk artists' },
  { time: 'Final day — 8 AM', task: 'Final aarti and pushpanjali', owner: 'Pujari' },
  { time: 'Final day — 10 AM', task: 'Visarjan procession departs', owner: 'Organizer' },
  { time: 'Final day — 2 PM', task: 'Pandal teardown and site cleanup', owner: 'Contractor' },
];

export const RUN_SHEETS: Record<EventType, RunSheet> = {
  wedding: { eventLabel: 'Wedding Day', blocks: WEDDING_RUN_SHEET },
  birthday: { eventLabel: 'Birthday Celebration', blocks: BIRTHDAY_RUN_SHEET },
  community: { eventLabel: 'Community Festival', blocks: COMMUNITY_RUN_SHEET },
};

export function getRunSheet(eventType: EventType): RunSheet {
  return RUN_SHEETS[eventType];
}
