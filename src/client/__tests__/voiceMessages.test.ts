import { describe, expect, it, vi } from 'vitest';
import { VoiceAudio } from '../components/voice/voiceAudio';
import { voiceMessageHandler } from '../components/voice/voiceMessages';
import { voiceSetup } from '../components/voice/voiceSetup';

function setup() {
  const audio = new VoiceAudio(vi.fn());
  const interrupt = vi.spyOn(audio, 'interrupt').mockImplementation(() => undefined);
  const play = vi.spyOn(audio, 'play').mockImplementation((_encoded, done) => {
    done();
  });
  const setStatus = vi.fn();
  const add = vi.fn((_role: string, _text: string) => 'message-id');
  const append = vi.fn();
  const execute = vi.fn((_name: string, _args: Record<string, string>) =>
    Promise.resolve('tool-output'),
  );
  const send = vi.fn();
  return {
    audio,
    interrupt,
    play,
    setStatus,
    add,
    append,
    execute,
    send,
    handle: voiceMessageHandler({ audio, setStatus, add, append, execute, send }),
  };
}

describe('validated live voice messages', () => {
  it('ignores invalid JSON and malformed frames without running tools', async () => {
    const session = setup();
    await session.handle('invalid-json');
    await session.handle(JSON.stringify({ toolCall: { functionCalls: [{ name: 'missing-id' }] } }));
    expect(session.execute).not.toHaveBeenCalled();
    expect(session.setStatus).not.toHaveBeenCalled();
  });
  it('handles setup, input/output transcripts and audio without losing streamed chunks', async () => {
    const session = setup();
    await session.handle(JSON.stringify({ setupComplete: {} }));
    await session.handle(
      JSON.stringify({
        serverContent: {
          inputTranscription: { text: 'नमस्ते' },
          outputTranscription: { text: 'Hello' },
          modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'AAAA' } }] },
        },
      }),
    );
    await session.handle(
      JSON.stringify({
        serverContent: { outputTranscription: { text: ' again' }, turnComplete: true },
      }),
    );
    expect(session.setStatus).toHaveBeenCalledWith('listening');
    expect(session.setStatus).toHaveBeenCalledWith('speaking');
    expect(session.add).toHaveBeenCalledWith('user', 'नमस्ते');
    expect(session.add).toHaveBeenCalledWith('agent', '');
    expect(session.append.mock.calls).toEqual([
      ['message-id', 'Hello'],
      ['message-id', ' again'],
    ]);
    expect(session.play).toHaveBeenCalledOnce();
  });
  it('stops current audio on interruption and returns validated tool results', async () => {
    const session = setup();
    await session.handle(JSON.stringify({ serverContent: { interrupted: true } }));
    expect(session.interrupt).toHaveBeenCalledOnce();
    await session.handle(
      JSON.stringify({
        toolCall: { functionCalls: [{ id: 'call-id', name: 'get_celebration_plan', args: {} }] },
      }),
    );
    expect(session.execute).toHaveBeenCalledWith('get_celebration_plan', {});
    expect(session.send).toHaveBeenCalledWith(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            { id: 'call-id', name: 'get_celebration_plan', response: { output: 'tool-output' } },
          ],
        },
      }),
    );
  });
  it('contains a same-origin tool setup and restrained bilingual planning instructions', () => {
    const setupMessage = voiceSetup().setup;
    expect(setupMessage.inputAudioTranscription).toEqual({});
    expect(setupMessage.systemInstruction.parts[0]?.text).toContain('Hindi');
    expect(setupMessage.systemInstruction.parts[0]?.text).toContain('never invent');
    expect(setupMessage.tools[0]?.functionDeclarations).toHaveLength(3);
  });
});
