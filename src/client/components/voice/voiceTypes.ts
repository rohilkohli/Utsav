import type { PlanOutput, WizardInput } from '@shared/schemas';
export type AgentStatus = 'idle' | 'connecting' | 'ready' | 'listening' | 'speaking' | 'ended';
export type TabName = 'budget' | 'timeline' | 'vendors' | 'ideas' | 'runsheet';
export interface VoiceAgentProps {
  plan?: PlanOutput | null;
  input?: WizardInput | null;
  onNavigateTab?: (tab: TabName) => void;
}
