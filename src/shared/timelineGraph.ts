import { requireValue } from './invariants.js';
import type { Milestone } from './schemas.js';

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleError';
  }
}
function graph(milestones: Milestone[]): Map<string, Milestone> {
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  if (byId.size !== milestones.length) throw new ScheduleError('Duplicate milestone ID');
  for (const milestone of milestones)
    for (const dependency of milestone.dependsOn ?? []) {
      if (!byId.has(dependency)) throw new ScheduleError(`Unknown dependency ID: ${dependency}`);
    }
  return byId;
}

export function detectCycles(milestones: Milestone[]): boolean {
  const byId = graph(milestones);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of requireValue(byId.get(id)).dependsOn ?? [])
      if (visit(dependency)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return milestones.some((milestone) => visit(milestone.id));
}

export function topoOrder(milestones: Milestone[]): Milestone[] {
  const byId = graph(milestones);
  if (detectCycles(milestones)) throw new ScheduleError('Milestone dependency cycle detected');
  const ordered: Milestone[] = [];
  const visited = new Set<string>();
  const visit = (milestone: Milestone): void => {
    if (visited.has(milestone.id)) return;
    visited.add(milestone.id);
    for (const dependency of milestone.dependsOn ?? []) {
      visit(requireValue(byId.get(dependency)));
    }
    ordered.push(milestone);
  };
  milestones.forEach(visit);
  return ordered;
}

/** Virtual ceremony edges supplement explicit DAGs without changing persisted deadlines. */
export function inferCeremonyDependencies(milestones: Milestone[]): {
  milestones: Milestone[];
  ceremonyEdges: Map<string, string>;
} {
  topoOrder(milestones);
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  const previous = new Map<string, string>();
  const ceremonyEdges = new Map<string, string>();
  for (const milestone of [...milestones].sort(
    (left, right) => right.daysBeforeEvent - left.daysBeforeEvent,
  )) {
    const ceremony = milestone.subEvent?.trim();
    if (!ceremony || ceremony.toLowerCase() === 'general') continue;
    const dependency = previous.get(ceremony);
    previous.set(ceremony, milestone.id);
    if (!dependency || milestone.dependsOn?.includes(dependency)) continue;
    byId.set(milestone.id, {
      ...milestone,
      dependsOn: [...(milestone.dependsOn ?? []), dependency],
    });
    if (detectCycles([...byId.values()])) byId.set(milestone.id, milestone);
    else ceremonyEdges.set(milestone.id, dependency);
  }
  return { milestones: [...byId.values()], ceremonyEdges };
}
