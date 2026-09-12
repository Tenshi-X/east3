import { query } from './_db';

// ─── Embedding helper ─────────────────────────────────────────────────────────
// OpenRouter (the AI provider for chat) does not offer a free embedding endpoint
// yet, so vector embeddings remain an OPTIONAL Gemini feature: when GEMINI_API_KEY
// is set we generate pgvector embeddings; when it is missing (or the model fails)
// searchNotesSemantic falls back to plain keyword search, so the app keeps working.
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set (embeddings are optional — keyword search will be used)');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding error ${response.status}: ${err}`);
  }

  const result = await response.json();
  const embedding = result.embedding?.values;
  if (!embedding) throw new Error('Failed to generate embedding');
  return embedding;
}

// ─── Semantic note search (pgvector) ──────────────────────────────────────────
export async function searchNotesSemantic(
  userId: string,
  queryText: string,
  limit = 5
): Promise<any[]> {
  try {
    const embedding = await generateEmbedding(queryText);
    // Cast vector parameter to pgvector type
    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows = await query(
      `SELECT id, title, content, type, tags,
              1 - (embedding <=> $1::vector) AS similarity,
              created_at
       FROM notes
       WHERE user_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT ${limit}`,
      [vectorLiteral, userId]
    );
    return rows;
  } catch {
    // Fallback to keyword search
    const rows = await query(
      `SELECT id, title, content, type, tags, 1 AS similarity, created_at
       FROM notes
       WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [userId, `%${queryText}%`]
    );
    return rows;
  }
}