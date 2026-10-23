// Shared transport for chat, vision and briefs. No paid fallback.
const FREE_ROUTER = "openrouter/free";
const DEFAULT_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "inclusionai/ling-3.0-flash-vl:free",
  "inclusionai/ling-3.0-flash-sante:free",
  "thinkingmachines/inkling-small:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "liquid/lfm-2.5-2.6b:free",
  "poolside/laguna-s-2.1:free",
  "nex-agi/nex-n2.5-mini:free",
];
type Model = { id: string; tools: boolean; images: boolean; context: number };
export type RouterOptions = {
  tools?: boolean;
  maxTokens?: number;
  deadline?: number;
};
export class AIProviderError extends Error {
  constructor(
    message: string,
    public statusCode = 502,
    public reasonCode = "AI_PROVIDER_ERROR",
  ) {
    super(message);
  }
}
const zero = (value: unknown) =>
  ((typeof value === "string" && value.trim() !== "") ||
    typeof value === "number") &&
  Number(value) === 0;

export function createFreeRouter(
  fetcher: typeof fetch = (...args) => fetch(...args),
  policy = { attemptMs: 18_000, catalogMs: 3_500, totalMs: 55_000 },
) {
  let catalog: Model[] = [];
  let refreshedAt = 0;
  let refresh: Promise<void> | undefined;
  const cooldown = new Map<string, number>();
  async function refreshCatalog(apiKey: string, deadline: number) {
    if (Date.now() - refreshedAt < (catalog.length ? 3_600_000 : 60_000))
      return;
    if (!refresh) {
      refresh = (async () => {
        try {
          const response = await fetcher(
            "https://openrouter.ai/api/v1/models",
            {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(
                Math.max(1, Math.min(policy.catalogMs, deadline - Date.now())),
              ),
            },
          );
          if (!response.ok) return;
          const data = await response.json();
          if (!Array.isArray(data.data)) return;
          catalog = data.data
            .filter(
              (m: any) =>
                typeof m.id === "string" &&
                m.id !== FREE_ROUTER &&
                zero(m.pricing?.prompt) &&
                zero(m.pricing?.completion) &&
                ["request", "image"].every(
                  (k) => m.pricing?.[k] == null || zero(m.pricing[k]),
                ) &&
                m.architecture?.output_modalities?.includes("text") &&
                !["lyria", "content-safety", "schematron"].some((k) =>
                  m.id.includes(k),
                ),
            )
            .map((m: any) => ({
              id: m.id,
              tools: m.supported_parameters?.includes("tools") === true,
              images:
                m.architecture?.input_modalities?.includes("image") === true,
              context: Number(m.context_length) || 0,
            }));
        } catch {
          /* The free router also works when the catalog is unavailable. */
        } finally {
          refreshedAt = Date.now();
        }
      })().finally(() => {
        refresh = undefined;
      });
    }
    await refresh;
  }
  return async function request(
    messages: any[],
    systemPrompt: string,
    tools: any[],
    opts: RouterOptions = {},
  ) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new AIProviderError("Layanan AI belum dikonfigurasi.");
    const deadline = Math.min(
      opts.deadline ?? Infinity,
      Date.now() + policy.totalMs,
    );
    if (deadline <= Date.now())
      throw new AIProviderError("Waktu tunggu AI habis. Silakan coba lagi.");
    await refreshCatalog(apiKey, deadline);
    const wantTools = opts.tools ?? true;
    const hasImage = messages.some(
      (m) =>
        Array.isArray(m.parts) &&
        m.parts.some((p: any) => p.imageUrl || p.inlineData),
    );
    const maxTokens = opts.maxTokens ?? (wantTools ? 2048 : 1024);
    const openAIMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content:
          Array.isArray(m.parts) &&
          m.parts.some((p: any) => p.imageUrl || p.inlineData)
            ? m.parts
                .map((p: any) =>
                  p.text
                    ? { type: "text", text: p.text }
                    : p.imageUrl || p.inlineData
                      ? {
                          type: "image_url",
                          image_url: { url: p.imageUrl || p.inlineData },
                        }
                      : null,
                )
                .filter(Boolean)
            : typeof m.parts === "string"
              ? m.parts
              : (m.parts ?? []).map((p: any) => p.text ?? "").join("\n"),
      })),
    ];
    const textChars =
      systemPrompt.length +
      messages.reduce(
        (n, m) =>
          n +
          (typeof m.parts === "string"
            ? m.parts.length
            : (m.parts ?? []).reduce(
                (s: number, p: any) => s + (p.text?.length ?? 0),
                0,
              )),
        0,
      );
    // Conservative text estimate; image token accounting is provider-specific.
    const estimatedTokens =
      Math.ceil(
        (textChars + (wantTools ? JSON.stringify(tools).length : 0)) / 2,
      ) +
      maxTokens +
      (hasImage ? 4096 : 0);
    const priority = [
      ...(process.env.OPENROUTER_FALLBACK_MODELS ?? "")
        .split(",")
        .map((s) => s.trim()),
      ...DEFAULT_MODELS,
    ];
    const eligible = catalog.filter(
      (m) =>
        (!wantTools || m.tools) &&
        (!hasImage || m.images) &&
        m.context >= estimatedTokens &&
        (cooldown.get(m.id) ?? 0) <= Date.now(),
    );
    eligible.sort((a, b) => {
      const rank = (id: string) => {
        const i = priority.indexOf(id);
        return i < 0 ? priority.length : i;
      };
      return rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);
    });
    // Two compatible models, then the free router; never exhaust the catalog.
    const candidates = eligible.slice(0, 2).map((m) => m.id);
    if ((cooldown.get(FREE_ROUTER) ?? 0) <= Date.now())
      candidates.push(FREE_ROUTER);
    let lastError: AIProviderError | undefined;
    for (const model of candidates) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const body = {
        model,
        messages: openAIMessages,
        temperature: wantTools ? 0.2 : 0.5,
        max_tokens: maxTokens,
        provider: {
          require_parameters: true,
          max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
        },
        ...(wantTools ? { tools, tool_choice: "auto" } : {}),
      };
      try {
        const response = await fetcher(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "X-Title": "Atlas",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(
              Math.max(1, Math.min(policy.attemptMs, remaining)),
            ),
          },
        );
        // Read the provider error first: a 403 is not proof of an invalid key.
        // Some errors arrive inside a 200 response after generation has started.
        let data: any;
        try {
          data = await response.json();
        } catch {
          if (response.status !== 401 && response.status !== 403)
            throw new Error("Invalid provider response");
          data = {};
        }
        if (!response.ok || data.error) {
          const code =
            response.status === 401 || response.status === 403
              ? response.status
              : Number(data.error?.code) || response.status;
          const detail = String(data.error?.message ?? "");
          const metadata = data.error?.metadata ?? {};
          // Log only routing/error identifiers, never prompts, raw provider data,
          // Authorization headers, or keys. Logs distinguish runtime failures
          // from successful deployment builds.
          const safe = (value: unknown) =>
            typeof value === "string" &&
            /^[a-zA-Z0-9_./: -]{1,100}$/.test(value)
              ? value
              : undefined;
          console.warn("OpenRouter request rejected", {
            model,
            status: code,
            error_type: safe(metadata.error_type),
            provider: safe(metadata.provider_name),
            limit_source: safe(metadata.limit_source),
          });
          if (code === 401)
            throw new AIProviderError(
              "Autentikasi OpenRouter gagal (401). API key perlu diperiksa oleh pengelola aplikasi.",
              502,
              "OPENROUTER_AUTH",
            );
          if (code === 403) {
            // Do not retry a forbidden request against another model: account
            // budgets and content/guardrail policies must remain enforced.
            if (
              [
                "openrouter_guardrail_budget",
                "openrouter_workspace_budget",
                "openrouter_key_limit",
              ].includes(metadata.limit_source)
            )
              throw new AIProviderError(
                "Batas penggunaan akun atau API key OpenRouter tercapai (403). Periksa batas penggunaan di OpenRouter.",
                502,
                "OPENROUTER_BUDGET",
              );
            if (
              Array.isArray(metadata.reasons) ||
              metadata.guardrail_id ||
              /guardrail|moderation|content.policy|request blocked/i.test(
                detail,
              )
            )
              throw new AIProviderError(
                "Permintaan ditolak oleh kebijakan OpenRouter atau penyedia model (403).",
                502,
                "OPENROUTER_POLICY",
              );
            if (/data.policy|privacy|data collection|publication/i.test(detail))
              throw new AIProviderError(
                "Pengaturan privasi OpenRouter tidak mengizinkan akses model ini (403). Periksa pengaturan privasi di OpenRouter.",
                502,
                "OPENROUTER_PRIVACY",
              );
            throw new AIProviderError(
              "OpenRouter menolak akses (403). Periksa izin akun/API key serta akses model; ini tidak selalu berarti API key salah.",
              502,
              "OPENROUTER_FORBIDDEN",
            );
          }
          if (
            code === 429 &&
            /daily|per.day|requests.*day|quota.*day/i.test(detail)
          )
            throw new AIProviderError(
              "Kuota harian AI gratis sudah habis. Coba lagi setelah kuota direset.",
              429,
              "OPENROUTER_DAILY_LIMIT",
            );
          const retryAfter = response.headers?.get("retry-after");
          const seconds = retryAfter ? Number(retryAfter) : NaN;
          const retryMs = Number.isFinite(seconds)
            ? seconds * 1000
            : retryAfter
              ? Date.parse(retryAfter) - Date.now()
              : NaN;
          cooldown.set(
            model,
            Date.now() +
              Math.max(
                1000,
                Number.isFinite(retryMs)
                  ? Math.min(retryMs, 3_600_000)
                  : code === 429
                    ? 60_000
                    : 180_000,
              ),
          );
          lastError = new AIProviderError(
            code === 429
              ? "AI gratis sedang sibuk. Coba lagi beberapa saat."
              : "Model AI gratis belum tersedia. Silakan coba lagi.",
            code === 429 ? 429 : 502,
          );
          continue;
        }
        const choice = data.choices?.[0];
        if (!choice?.message || choice.finish_reason === "length")
          throw new Error("Incomplete AI response");
        const message = choice.message;
        const parts: any[] = [];
        for (const tc of message.tool_calls ?? []) {
          if (
            !wantTools ||
            !tools.some((t) => t.function.name === tc.function?.name)
          )
            throw new Error("Unknown tool");
          // Never execute malformed/truncated arguments as an empty object.
          const args = JSON.parse(tc.function.arguments);
          if (!args || typeof args !== "object" || Array.isArray(args))
            throw new Error("Invalid tool arguments");
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
        if (typeof message.content === "string" && message.content.trim())
          parts.push({ text: message.content });
        if (!parts.length) throw new Error("Empty AI response");
        cooldown.delete(model);
        return {
          candidates: [{ content: { parts } }],
          modelUsed: data.model || model,
        };
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        cooldown.set(model, Date.now() + 60_000);
        lastError = new AIProviderError(
          "AI belum memberikan jawaban lengkap. Silakan coba lagi.",
        );
      }
    }
    throw (
      lastError ??
      new AIProviderError(
        "AI gratis sedang sibuk atau waktu tunggu habis. Coba lagi beberapa saat.",
      )
    );
  };
}
export const requestFreeModel = createFreeRouter();
