import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne } from './_db';
import { requireUser } from './_auth';
import { searchNotesSemantic } from './_embedding';

// ─── Tool definitions for Gemini function calling ────────────────────────────
const TOOLS = [
  {
    name: 'create_event',
    description: 'Membuat event kalender baru',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Judul event' },
        start_time: { type: 'string', description: 'Waktu mulai dalam format ISO 8601' },
        end_time: { type: 'string', description: 'Waktu selesai dalam format ISO 8601' },
        recurrence_rule: { type: 'string', description: 'RRULE string untuk event berulang (opsional)' },
        color: { type: 'string', description: 'Hex color untuk event (opsional)' },
      },
      required: ['title', 'start_time', 'end_time'],
    },
  },
  {
    name: 'create_priority',
    description: 'Menambahkan item ke prioritas harian',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Judul prioritas' },
        date: { type: 'string', description: 'Tanggal dalam format YYYY-MM-DD (default: hari ini)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'log_transaction',
    description: 'Mencatat transaksi keuangan (pengeluaran atau pemasukan)',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Jumlah dalam Rupiah (angka positif)' },
        type: { type: 'string', enum: ['income', 'expense'], description: 'Tipe transaksi' },
        category: {
          type: 'string',
          enum: ['food', 'transport', 'shopping', 'health', 'entertainment', 'education', 'utilities', 'gym', 'investment', 'salary', 'freelance', 'other'],
          description: 'Kategori transaksi',
        },
        note: { type: 'string', description: 'Catatan tambahan (opsional)' },
        date: { type: 'string', description: 'Tanggal dalam format YYYY-MM-DD (default: hari ini)' },
      },
      required: ['amount', 'type', 'category'],
    },
  },
  {
    name: 'get_budget_status',
    description: 'Mengambil status budget dan pengeluaran untuk bulan tertentu',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Bulan dalam format YYYY-MM (default: bulan ini)' },
        category: { type: 'string', description: 'Kategori spesifik (opsional, kosongkan untuk semua)' },
      },
    },
  },
  {
    name: 'create_workout_plan',
    description: 'Membuat workout plan baru',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nama workout plan' },
        split_type: { type: 'string', enum: ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'] },
        day_of_week: { type: 'array', items: { type: 'number' }, description: 'Array hari (0=Minggu, 1=Senin, ..., 6=Sabtu)' },
      },
      required: ['name', 'split_type'],
    },
  },
  {
    name: 'log_workout_set',
    description: 'Log satu set latihan dalam sesi workout',
    parameters: {
      type: 'object',
      properties: {
        exercise_name: { type: 'string', description: 'Nama exercise' },
        weight: { type: 'number', description: 'Berat dalam kg' },
        reps: { type: 'number', description: 'Jumlah repetisi' },
        set_number: { type: 'number', description: 'Nomor set' },
        rpe: { type: 'number', description: 'Rate of Perceived Exertion (1-10, opsional)' },
      },
      required: ['exercise_name', 'weight', 'reps', 'set_number'],
    },
  },
  {
    name: 'create_habit',
    description: 'Membuat habit baru untuk dilacak',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nama habit' },
        target_value: { type: 'number', description: 'Target harian (default: 1)' },
        unit: { type: 'string', description: 'Satuan target (kali, ml, menit, dll)' },
        frequency: { type: 'string', enum: ['daily', 'weekly'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'log_habit',
    description: 'Log progress/completion habit',
    parameters: {
      type: 'object',
      properties: {
        habit_name: { type: 'string', description: 'Nama habit yang ingin di-log' },
        value: { type: 'number', description: 'Nilai yang dicatat (default: target penuh = completed)' },
      },
      required: ['habit_name'],
    },
  },
  {
    name: 'create_note',
    description: 'Menyimpan catatan ke Second Brain',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['meeting', 'idea', 'sop', 'journal', 'bookmark'] },
        title: { type: 'string', description: 'Judul catatan' },
        content: { type: 'string', description: 'Isi catatan' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag catatan' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'search_notes',
    description: 'Mencari catatan di Second Brain secara semantik',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Kata kunci atau pertanyaan untuk mencari catatan' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_daily_summary',
    description: 'Mengambil ringkasan hari ini untuk Morning Brief',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Tanggal dalam format YYYY-MM-DD (default: hari ini)' },
      },
    },
  },
];

// ─── Build system prompt ──────────────────────────────────────────────────────
function buildSystemPrompt(userTimezone: string): string {
  const now = new Date().toLocaleString('id-ID', { timeZone: userTimezone });
  return `Kamu adalah east3 AI Copilot — asisten pribadi cerdas yang membantu pengguna mengelola seluruh kehidupan mereka.

Waktu sekarang: ${now} (${userTimezone})

KEMAMPUAN KAMU:
- Mengelola kalender dan jadwal (create_event)
- Mencatat prioritas harian (create_priority)  
- Mencatat keuangan/transaksi (log_transaction, get_budget_status)
- Mengelola workout dan latihan (create_workout_plan, log_workout_set)
- Melacak kebiasaan/habit (create_habit, log_habit)
- Menyimpan dan mencari catatan (create_note, search_notes)
- Membuat ringkasan harian (get_daily_summary)

ATURAN PENTING:
1. Selalu gunakan tool calls untuk TINDAKAN nyata (bukan hanya menjawab)
2. Untuk tanggal/waktu, gunakan format ISO 8601 dan sesuaikan dengan timezone user
3. Kategori keuangan HARUS salah satu dari: food, transport, shopping, health, entertainment, education, utilities, gym, investment, salary, freelance, other
4. Jawab dalam Bahasa Indonesia yang ramah dan natural
5. Konfirmasi sebelum melakukan aksi yang tidak bisa dibatalkan (hapus data)
6. Setelah eksekusi tool, berikan konfirmasi yang jelas dan ramah

GAYA KOMUNIKASI:
- Santai dan ramah seperti teman
- Langsung ke poin, tidak perlu basa-basi berlebihan
- Gunakan emoji secukupnya untuk membuat respons terasa lebih hidup
`;
}

// ─── Gemini API call ──────────────────────────────────────────────────────────
async function callGemini(messages: any[], systemPrompt: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        tools: [{ function_declarations: TOOLS }],
        tool_config: { function_calling_config: { mode: 'AUTO' } },
        generation_config: {
          temperature: 0.7,
          max_output_tokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini error ${response.status}: ${error}`);
  }

  return response.json();
}

// ─── OpenRouter fallback ──────────────────────────────────────────────────────
async function callOpenRouter(messages: any[], systemPrompt: string): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  let model = 'qwen/qwen3-4b:free';
  try {
    const modelsRes = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const freeModels = modelsData.data?.filter((m: any) => m.pricing?.prompt === '0');
      if (freeModels?.length > 0) {
        const qwen = freeModels.find((m: any) => m.id.includes('qwen'));
        model = qwen?.id ?? freeModels[0].id;
      }
    }
  } catch { /* Use default */ }

  const openAIMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: typeof m.parts === 'string' ? m.parts : m.parts?.[0]?.text ?? '',
    })),
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Title': 'east3 Personal Life OS',
    },
    body: JSON.stringify({
      model,
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return {
    candidates: [{
      content: {
        parts: [{ text: data.choices?.[0]?.message?.content ?? 'Maaf, tidak bisa menjawab sekarang.' }],
      },
    }],
    modelUsed: model,
  };
}

// ─── Execute tool call ────────────────────────────────────────────────────────
async function executeTool(toolName: string, params: any, userId: string): Promise<any> {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  switch (toolName) {
    case 'create_event': {
      const startTime = new Date(params.start_time);
      const endTime = new Date(params.end_time);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Format waktu tidak valid');
      }

      const rows = await query(
        `INSERT INTO events (user_id, title, start_time, end_time, recurrence_rule, color, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'ai')
         RETURNING id`,
        [userId, String(params.title), startTime.toISOString(), endTime.toISOString(),
         params.recurrence_rule ?? null, params.color ?? '#088395']
      );
      return { success: true, id: rows[0].id, message: `Event "${params.title}" berhasil dibuat` };
    }

    case 'create_priority': {
      const rows = await query(
        `INSERT INTO priorities (user_id, title, date, is_done)
         VALUES ($1, $2, $3, false) RETURNING id`,
        [userId, String(params.title), params.date ?? today]
      );
      return { success: true, id: rows[0].id, message: `Prioritas "${params.title}" ditambahkan` };
    }

    case 'log_transaction': {
      const amount = Number(params.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Jumlah tidak valid');

      const VALID_CATEGORIES = ['food', 'transport', 'shopping', 'health', 'entertainment', 'education', 'utilities', 'gym', 'investment', 'salary', 'freelance', 'other'];
      const category = VALID_CATEGORIES.includes(params.category) ? params.category : 'other';

      const rows = await query(
        `INSERT INTO transactions (user_id, amount, type, category, note, occurred_at, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'ai') RETURNING id`,
        [userId, amount, params.type, category, params.note ?? null,
         params.date ? `${params.date}T12:00:00` : new Date().toISOString()]
      );

      const typeLabel = params.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      return {
        success: true,
        id: rows[0].id,
        message: `${typeLabel} Rp ${amount.toLocaleString('id-ID')} (${category}) berhasil dicatat`,
      };
    }

    case 'get_budget_status': {
      const month = params.month ?? currentMonth;

      const txRows = await query(
        `SELECT amount, type, category FROM transactions
         WHERE user_id = $1 AND type = 'expense'
           AND occurred_at >= $2::date AND occurred_at < ($2::date + INTERVAL '1 month')
           ${params.category ? `AND category = $3` : ''}`,
        params.category
          ? [userId, `${month}-01`, params.category]
          : [userId, `${month}-01`]
      );

      const bdRows = await query(
        `SELECT * FROM budgets WHERE user_id = $1 AND month = $2 ${params.category ? `AND category = $3` : ''}`,
        params.category
          ? [userId, month, params.category]
          : [userId, month]
      );

      const spending: Record<string, number> = {};
      for (const tx of txRows) {
        spending[tx.category] = (spending[tx.category] ?? 0) + Number(tx.amount);
      }

      const totalSpent = Object.values(spending).reduce((a, b) => a + b, 0);
      const totalBudget = bdRows.reduce((s: number, b: any) => s + Number(b.monthly_limit), 0);

      return {
        success: true,
        month,
        total_spent: totalSpent,
        total_budget: totalBudget,
        remaining: totalBudget - totalSpent,
        spending_by_category: spending,
        budgets: bdRows,
      };
    }

    case 'create_workout_plan': {
      const rows = await query(
        `INSERT INTO workout_plans (user_id, name, split_type, day_of_week, exercises)
         VALUES ($1, $2, $3, $4, '[]') RETURNING id`,
        [userId, String(params.name), params.split_type ?? 'custom', params.day_of_week ?? []]
      );
      return { success: true, id: rows[0].id, message: `Workout plan "${params.name}" berhasil dibuat` };
    }

    case 'log_workout_set': {
      let log = await queryOne<{ id: string }>(
        `SELECT id FROM workout_logs WHERE user_id = $1 AND date = $2::date LIMIT 1`,
        [userId, today]
      );
      if (!log) {
        const rows = await query<{ id: string }>(
          `INSERT INTO workout_logs (user_id, date) VALUES ($1, $2::date) RETURNING id`,
          [userId, today]
        );
        log = rows[0];
      }
      if (!log) throw new Error('Gagal membuat workout log');

      const rows = await query(
        `INSERT INTO workout_sets (workout_log_id, exercise_name, weight, reps, set_number, rpe)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [log.id, String(params.exercise_name), Number(params.weight), Number(params.reps),
         Number(params.set_number), params.rpe ? Number(params.rpe) : null]
      );
      return {
        success: true,
        id: rows[0].id,
        message: `Set ${params.set_number}: ${params.exercise_name} ${params.weight}kg × ${params.reps} reps dicatat`,
      };
    }

    case 'create_habit': {
      const rows = await query(
        `INSERT INTO habits (user_id, name, target_value, unit, frequency, icon, color, is_active)
         VALUES ($1, $2, $3, $4, $5, '✅', '#088395', true) RETURNING id`,
        [userId, String(params.name), params.target_value ?? 1, params.unit ?? 'kali', params.frequency ?? 'daily']
      );
      return { success: true, id: rows[0].id, message: `Habit "${params.name}" berhasil dibuat` };
    }

    case 'log_habit': {
      const habit = await queryOne<{ id: string; name: string; target_value: number }>(
        `SELECT id, name, target_value FROM habits
         WHERE user_id = $1 AND name ILIKE $2 AND is_active = true LIMIT 1`,
        [userId, `%${params.habit_name}%`]
      );
      if (!habit) throw new Error(`Habit "${params.habit_name}" tidak ditemukan`);

      const value = params.value ?? habit.target_value;
      const isCompleted = value >= habit.target_value;

      const rows = await query(
        `INSERT INTO habit_logs (habit_id, date, value, is_completed)
         VALUES ($1, $2::date, $3, $4)
         ON CONFLICT (habit_id, date)
         DO UPDATE SET value = EXCLUDED.value, is_completed = EXCLUDED.is_completed
         RETURNING id`,
        [habit.id, today, value, isCompleted]
      );

      return {
        success: true,
        id: rows[0].id,
        message: isCompleted
          ? `Habit "${habit.name}" selesai hari ini! 🎉`
          : `Progress habit "${habit.name}": ${value}/${habit.target_value}`,
      };
    }

    case 'create_note': {
      const VALID_TYPES = ['meeting', 'idea', 'sop', 'journal', 'bookmark'];
      const noteType = VALID_TYPES.includes(params.type) ? params.type : 'idea';

      const rows = await query(
        `INSERT INTO notes (user_id, type, title, content, tags, embedding)
         VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id`,
        [userId, noteType, String(params.title), String(params.content), params.tags ?? []]
      );
      return { success: true, id: rows[0].id, message: `Catatan "${params.title}" berhasil disimpan di Second Brain` };
    }

    case 'search_notes': {
      const results = await searchNotesSemantic(userId, String(params.query));
      return {
        success: true,
        results,
        message: `Ditemukan ${results.length} catatan untuk "${params.query}"`,
      };
    }

    case 'get_daily_summary': {
      const date = params.date ?? today;
      const month = date.slice(0, 7);

      const [events, priorities, txRows, habits, workouts] = await Promise.all([
        query(`SELECT title, start_time, end_time FROM events
               WHERE user_id = $1 AND start_time >= $2::date AND start_time < ($2::date + INTERVAL '1 day')`,
              [userId, date]),
        query(`SELECT title, is_done FROM priorities WHERE user_id = $1 AND date = $2::date`, [userId, date]),
        query(`SELECT amount, type, category FROM transactions
               WHERE user_id = $1 AND occurred_at >= $2::date AND occurred_at < ($2::date + INTERVAL '1 month')`,
              [userId, month]),
        query(`SELECT name, target_value FROM habits WHERE user_id = $1 AND is_active = true`, [userId]),
        query(`SELECT date, notes FROM workout_logs WHERE user_id = $1 AND date = $2::date`, [userId, date]),
      ]);

      const totalExpense = txRows
        .filter((t: any) => t.type === 'expense')
        .reduce((s: number, t: any) => s + Number(t.amount), 0);

      return {
        date,
        events,
        priorities,
        monthly_expense: totalExpense,
        habits_count: habits.length,
        had_workout: workouts.length > 0,
      };
    }

    default:
      throw new Error(`Tool tidak dikenal: ${toolName}`);
  }
}

// ─── Morning Brief handler ────────────────────────────────────────────────────
async function handleMorningBrief(userId: string, date: string, systemPrompt: string): Promise<string> {
  // Check cache
  const cached = await queryOne<{ content: string }>(
    `SELECT content FROM morning_briefs WHERE user_id = $1 AND date = $2::date`,
    [userId, date]
  );
  if (cached?.content) return cached.content;

  const today = date;
  const month = date.slice(0, 7);

  const [events, priorities, txRows, habits, workoutPlans] = await Promise.all([
    query(`SELECT title, start_time FROM events
           WHERE user_id = $1 AND start_time >= $2::date AND start_time < ($2::date + INTERVAL '1 day')`,
          [userId, today]),
    query(`SELECT title FROM priorities WHERE user_id = $1 AND date = $2::date`, [userId, today]),
    query(`SELECT amount, type FROM transactions
           WHERE user_id = $1 AND occurred_at >= $2::date AND occurred_at < ($2::date + INTERVAL '1 month')`,
          [userId, month]),
    query(`SELECT name FROM habits WHERE user_id = $1 AND is_active = true`, [userId]),
    query(`SELECT name, split_type, day_of_week FROM workout_plans WHERE user_id = $1`, [userId]),
  ]);

  const totalExpense = txRows
    .filter((t: any) => t.type === 'expense')
    .reduce((s: number, t: any) => s + Number(t.amount), 0);

  const todayPlan = workoutPlans.find((p: any) =>
    p.day_of_week?.includes(new Date().getDay())
  );

  const context = {
    date: today,
    events_count: events.length,
    events: events.map((e: any) => ({ title: e.title, time: e.start_time })),
    priorities: priorities.map((p: any) => p.title),
    monthly_expense_idr: totalExpense,
    habits_count: habits.length,
    today_workout: todayPlan ? `${todayPlan.split_type.toUpperCase()} - ${todayPlan.name}` : null,
  };

  const promptMessages = [{
    role: 'user',
    parts: [{ text: `Buatkan morning brief yang ramah dan memotivasi untuk hari ini. Data konteks (gunakan untuk referensi, jangan sebutkan angka keuangan spesifik):
${JSON.stringify(context, null, 2)}

Format: 2-3 paragraf singkat. Mulai dengan sapaan + tanggal. Sebutkan agenda hari ini. Motivasi singkat di akhir.` }],
  }];

  let briefContent = 'Selamat pagi! Semangat jalani hari ini ya 💪';

  try {
    const result = await callGemini(promptMessages, systemPrompt);
    briefContent = result.candidates?.[0]?.content?.parts?.[0]?.text ?? briefContent;
  } catch {
    try {
      const result = await callOpenRouter(promptMessages, systemPrompt);
      briefContent = result.candidates?.[0]?.content?.parts?.[0]?.text ?? briefContent;
    } catch { /* use default */ }
  }

  // Cache the brief
  await query(
    `INSERT INTO morning_briefs (user_id, date, content)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (user_id, date)
     DO UPDATE SET content = EXCLUDED.content`,
    [userId, date, briefContent]
  );

  return briefContent;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error } = await requireUser(req);
  if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });
  const userId = user.id;

  const { action, conversation_id, message, date } = req.body;

  // Get user profile for timezone
  const profile = await queryOne<{ timezone: string }>(
    `SELECT timezone FROM users WHERE id = $1`, [userId]
  );
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

  // Handle regular chat message
  if (!message || !conversation_id) {
    return res.status(400).json({ error: 'message and conversation_id required' });
  }

  // Verify conversation ownership
  const conv = await queryOne(`SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversation_id, userId]);
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
        modelUsed = result.modelUsed ?? 'openrouter-fallback';
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

      const successCount = toolResults.filter(r => !r.error).length;
      const messages = toolResults.map(r =>
        r.error ? `❌ ${r.tool}: ${r.error}` : `✅ ${r.result?.message ?? 'Berhasil'}`
      );

      responseText = messages.join('\n');

      if (successCount > 0 && successCount === toolResults.length) {
        responseText += '\n\nAda hal lain yang bisa aku bantu?';
      }
    } else {
      responseText = parts.find((p: any) => p.text)?.text ?? 'Maaf, aku tidak bisa memproses permintaan itu sekarang.';
    }

  } catch (err: any) {
    console.error('AI proxy error:', err);
    responseText = 'Maaf, AI sedang sibuk. Coba lagi sebentar lagi ya 🙏';
  }

  return res.json({ message: responseText, model_used: modelUsed });
}