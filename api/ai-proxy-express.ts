import { Router, Request, Response } from 'express';
import { query, queryOne } from './_db';
import { requireUser } from './_auth';
import { searchNotesSemantic } from './_embedding';
import { buildSystemPrompt, callGemini, callOpenRouter, executeTool, handleMorningBrief } from './ai-proxy';

const router = Router();

router.post('/ai-proxy', async (req: Request, res: Response) => {
  const { user, error } = await requireUser(req);
  if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });
  const userId = user.id;

  const { action, conversation_id, message, date, query: searchQuery } = req.body ?? {};

  // Get user profile for timezone
  const profile = await queryOne<{ timezone: string }>(`SELECT timezone FROM users WHERE id = $1`, [userId]);
  const timezone = profile?.timezone ?? 'Asia/Jakarta';
  const systemPrompt = buildSystemPrompt(timezone);

  // Handle morning brief request
  if (action === 'morning_brief') {
    try {
      const today = date ?? new Date().toISOString().split('T')[0];
      const brief = await handleMorningBrief(userId, today, systemPrompt);
      return res.json({ brief });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Handle semantic note search
  if (action === 'search_notes') {
    try {
      const results = await searchNotesSemantic(userId, String(searchQuery ?? ''));
      return res.json({ results });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Handle regular chat message
  if (!message || !conversation_id) {
    return res.status(400).json({ error: 'message and conversation_id required' });
  }

  // Verify conversation ownership
  const conv = await queryOne(`SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`, [
    conversation_id,
    userId,
  ]);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // Load conversation history
  const historyRows = await query<{ role: string; content: string }>(
    `SELECT role, content FROM ai_messages
     WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20`,
    [conversation_id]
  );

  const history = historyRows.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  history.push({ role: 'user', parts: [{ text: message }] });

  let responseText = '';
  let modelUsed = 'gemini-2.0-flash';

  try {
    let result;
    try {
      result = await callGemini(history, systemPrompt);
      modelUsed = 'gemini-2.0-flash';
    } catch (geminiErr: any) {
      console.error('Gemini failed:', geminiErr.message);
      try {
        result = await callGemini(history, systemPrompt);
      } catch {
        result = await callOpenRouter(history, systemPrompt);
        modelUsed = (result as any)?.modelUsed ?? 'openrouter-fallback';
      }
    }

    const candidate = result?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const toolCalls = parts.filter((p: any) => p.functionCall);

    if (toolCalls.length > 0) {
      const toolResults: any[] = [];

      for (const part of toolCalls) {
        const { name, args } = part.functionCall;
        try {
          const toolResult = await executeTool(name, args, userId);

          await query(
            `INSERT INTO ai_action_logs (user_id, tool_name, params, result, model_used)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, name, JSON.stringify(args), JSON.stringify(toolResult), modelUsed]
          );

          toolResults.push({ tool: name, result: toolResult });
        } catch (toolErr: any) {
          toolResults.push({ tool: name, error: toolErr.message });
        }
      }

      const successCount = toolResults.filter((r) => !r.error).length;
      const messages = toolResults.map((r) =>
        r.error ? `❌ ${r.tool}: ${r.error}` : `✅ ${r.result?.message ?? 'Berhasil'}`
      );

      responseText = messages.join('\n');

      if (successCount > 0 && successCount === toolResults.length) {
        responseText += '\n\nAda hal lain yang bisa aku bantu?';
      }
    } else {
      responseText =
        parts.find((p: any) => p.text)?.text ?? 'Maaf, aku tidak bisa memproses permintaan itu sekarang.';
    }
  } catch (err: any) {
    console.error('AI proxy error:', err);
    responseText = 'Maaf, AI sedang sibuk. Coba lagi sebentar lagi ya 🙏';
  }

  return res.json({ message: responseText, model_used: modelUsed });
});

export default router;
