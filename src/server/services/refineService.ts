import { nanoid } from 'nanoid';
import {
  geminiRefineOutputSchema,
  type Idea,
  type IdeaSection,
  type WizardInput,
} from '../../shared/schemas.js';
import { buildRefinePrompt } from '../prompts/plan.js';
import { AiResponseInvalidError, callModel, type AiCallContext } from './model.js';

export async function refineIdeasSection(
  section: IdeaSection,
  instruction: string,
  input: WizardInput,
  currentIdeas: Idea[],
  context: AiCallContext = {},
): Promise<{
  ideas: Idea[];
  source: 'gemini' | 'fallback';
  model?: string;
}> {
  const result = await callModel({
    ...context,
    schema: geminiRefineOutputSchema,
    prompt: buildRefinePrompt(section, instruction, input),
  });
  if (!result) return { ideas: currentIdeas, source: 'fallback' };
  // Keep refinement scoped even if a valid but unrelated section was generated.
  const ideas = result.data.ideas
    .filter((idea) => idea.section === section)
    .map((idea) => ({ ...idea, id: nanoid() }));
  if (!ideas.length) throw new AiResponseInvalidError();
  return { ideas, source: 'gemini', model: result.model };
}
