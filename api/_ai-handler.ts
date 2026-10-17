import { query, queryOne } from './_db';
import { requireUser } from './_auth';
import { searchNotesSemantic } from './_embedding';
import { buildSystemPrompt, callOpenRouter, executeTool, handleMorningBrief } from './ai-proxy';
async function processAIRequest(req: { headers: any; body?: any }, res: { status(code: number): any; json(body: any): any }) {
  const { user, error } = await requireUser(req);
  if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });
  const userId = user.id;

  const { action, conversation_id, message, date, image, query: searchQuery } = req.body ?? {};

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
      console.error('Morning brief failed:', err.message);
      return res.status(500).json({ error: 'Ringkasan harian belum dapat dimuat. Coba lagi.' });
    }
  }

  // Handle semantic note search
  if (action === 'search_notes') {
    try {
      const results = await searchNotesSemantic(userId, String(searchQuery ?? ''));
      return res.json({ results });
    } catch (err: any) {
      console.error('Note search failed:', err.message);
      return res.status(500).json({ error: 'Pencarian catatan belum dapat diproses. Coba lagi.' });
    }
  }

  // Handle regular chat message
  if (((typeof message !== 'string' || !message.trim()) && !image) || typeof conversation_id !== 'string' || !conversation_id) {
    return res.status(400).json({ error: 'message or image, and conversation_id required' });
  }

  if (image && (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 4 * 1024 * 1024)) {
    return res.status(400).json({ error: 'Gunakan gambar PNG, JPEG, WebP, atau GIF maksimal 3 MB' });
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
     WHERE conversation_id = $1 AND role IN ('user', 'assistant') ORDER BY created_at DESC, id DESC LIMIT 20`,
    [conversation_id]
  );

  const history = historyRows.reverse().map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const text = typeof message === 'string' && message.trim() ? message.trim() : 'Jelaskan gambar ini';
  const userParts: any[] = [{ text }];
  if (image) userParts.push({ inlineData: image });
  history.push({ role: 'user', parts: userParts });

  let responseText = '';
  let modelUsed = 'openrouter:free';
  try {
    const result = await callOpenRouter(history, systemPrompt);
    modelUsed = (result as any)?.modelUsed ?? 'openrouter:free';

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
    return res.status(502).json({ error: 'AI sedang tidak tersedia. Silakan coba lagi.' });
  }

  await query(
    `WITH saved AS (
       INSERT INTO ai_messages (conversation_id, role, content, created_at)
       VALUES ($1, 'user', $2, NOW()), ($1, 'assistant', $3, NOW() + INTERVAL '1 microsecond') RETURNING id
     )
     UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1 AND user_id = $4`,
    [conversation_id, image ? `${text}\n[Gambar dilampirkan]` : text, responseText, userId]
  );
  return res.json({ message: responseText, model_used: modelUsed });
}

export async function handleAIRequest(req: { headers: any; body?: any }, res: { status(code: number): any; json(body: any): any }) {
  try {
    return await processAIRequest(req, res);
  } catch (error: any) {
    console.error('AI request failed:', error.message);
    return res.status(500).json({ error: 'Permintaan AI tidak dapat diproses. Coba lagi.' });
  }
}
