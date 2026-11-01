import { z } from 'zod';
import type { AgentStatus } from './voiceTypes';
import type { VoiceTranscriptMessage } from './VoiceTranscript';
import type { VoiceAudio } from './voiceAudio';

const messageSchema = z.object({
  setupComplete: z.object({}).optional(),
  serverContent: z
    .object({
      interrupted: z.boolean().optional(),
      inputTranscription: z.object({ text: z.string().optional() }).optional(),
      outputTranscription: z.object({ text: z.string().optional() }).optional(),
      modelTurn: z
        .object({
          parts: z
            .array(
              z.object({
                inlineData: z
                  .object({ mimeType: z.string().optional(), data: z.string().optional() })
                  .optional(),
              }),
            )
            .optional(),
        })
        .optional(),
      turnComplete: z.boolean().optional(),
    })
    .optional(),
  toolCall: z
    .object({
      functionCalls: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          args: z.record(z.string(), z.string()).default({}),
        }),
      ),
    })
    .optional(),
});
interface Handlers {
  audio: VoiceAudio;
  setStatus: (status: AgentStatus) => void;
  add: (role: VoiceTranscriptMessage['role'], text: string) => string;
  append: (id: string, text: string) => void;
  execute: (name: string, args: Record<string, string>) => Promise<string>;
  send: (text: string) => void;
}
export function voiceMessageHandler(handlers: Handlers) {
  let agentId: string | null = null;
  return async (raw: string) => {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = messageSchema.safeParse(json);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.setupComplete) {
      handlers.setStatus('listening');
      handlers.add('system', '🎙️ Connected! Say hello to Utsav Voice.');
    }
    const content = message.serverContent;
    if (content) {
      if (content.interrupted) {
        handlers.audio.interrupt();
        handlers.setStatus('listening');
        agentId = null;
      }
      if (content.inputTranscription?.text) handlers.add('user', content.inputTranscription.text);
      if (content.outputTranscription?.text) {
        agentId ??= handlers.add('agent', '');
        handlers.append(agentId, content.outputTranscription.text);
      }
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          try {
            handlers.setStatus('speaking');
            handlers.audio.play(part.inlineData.data, () => {
              handlers.setStatus('listening');
            });
          } catch {
            handlers.add('system', 'An audio chunk could not be played.');
          }
        }
      }
      if (content.turnComplete) agentId = null;
    }
    if (message.toolCall) {
      const responses = [];
      for (const call of message.toolCall.functionCalls) {
        handlers.add('tool', `🔧 ${call.name}`);
        const output = await handlers.execute(call.name, call.args);
        responses.push({ id: call.id, name: call.name, response: { output } });
      }
      handlers.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }
  };
}
