import { useCallback } from 'react';
import { apiSearchVendors } from '../../lib/api';
import { planFacts } from '@shared/advisor';
import { getTodayInKolkata } from '@shared/schemas';
import type { VoiceAgentProps, TabName } from './voiceTypes';

export function useVoiceTools({ plan, input, onNavigateTab }: VoiceAgentProps) {
  return useCallback(
    async (name: string, args: Record<string, string>): Promise<string> => {
      if (name === 'get_celebration_plan') {
        return plan && input
          ? JSON.stringify(planFacts(plan, input, getTodayInKolkata()))
          : 'No plan yet. Please complete the celebration wizard first.';
      }
      if (name === 'search_vendors') {
        try {
          const suggestions = await apiSearchVendors(
            args.category ?? '',
            args.city ?? input?.city ?? '',
          );
          return suggestions.length ? JSON.stringify(suggestions) : 'No verified vendors found.';
        } catch {
          return 'Vendor search is unavailable. You can continue planning without it.';
        }
      }
      if (name === 'navigate_to_tab') {
        const tab = args.tab;
        if (tab && ['budget', 'timeline', 'vendors', 'ideas', 'runsheet'].includes(tab)) {
          onNavigateTab?.(tab as TabName);
          return `Opened ${tab}.`;
        }
        return 'Unknown dashboard tab.';
      }
      return 'Unknown tool.';
    },
    [plan, input, onNavigateTab],
  );
}
