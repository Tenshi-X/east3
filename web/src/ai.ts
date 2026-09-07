// Atlas AI Provider abstraction (client side).
// Server (/api/ai-proxy) already abstracts the real providers:
// Gemini Flash primary, OpenRouter fallback. UI NEVER calls
// any provider directly — it goes through this service + the API layer.
import { api } from './api';

export interface AIProvider {
  generate(text: string, conversationId?: string): Promise<{ message: string; model_used?: string }>;
  summarize(text: string): Promise<string>;
  toolCall(text: string, conversationId?: string): Promise<{ message: string; model_used?: string }>;
}

export const atlasAI: AIProvider = {
  async generate(text, conversationId) {
    let id = conversationId;
    if (!id) {
      const conv = await api.create('ai_conversations', { title: 'Atlas' });
      id = conv.data.id;
    }
    return api.aiChat(text, id!);
  },
  async summarize(text) {
    const r = await api.morningBrief(new Date().toISOString().slice(0,10));
    // Summarize returns brief content if exists, else generated text.

    return r.brief ?? text;
  },
  async toolCall(text, conversationId) {
    return this.generate(text, conversationId);
  },
};

export default atlasAI;