import { useMemo } from 'react';
import type { PlanOutput } from '@shared/schemas';
import { planSchedule } from '@shared/timelinePreparation';

export function usePlanSchedule(plan: PlanOutput, eventDate: string, today: string) {
  return useMemo(() => {
    try {
      return { tasks: planSchedule(plan, eventDate, today), error: '' };
    } catch (error) {
      return {
        tasks: [],
        error: error instanceof Error ? error.message : 'Invalid timeline dependencies',
      };
    }
  }, [plan, eventDate, today]);
}
