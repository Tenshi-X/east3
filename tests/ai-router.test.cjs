const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { rootDir: "." },
});
const { createFreeRouter, AIProviderError } = require("../api/_openrouter");
const { compactHistory, compactLifeContext } = require("../api/_ai-context");
let originalKey, originalModels;
beforeEach((t) => {
  t.mock.method(console, "warn", () => {});
  originalKey = process.env.OPENROUTER_API_KEY;
  originalModels = process.env.OPENROUTER_FALLBACK_MODELS;
  process.env.OPENROUTER_API_KEY = "test-key";
  delete process.env.OPENROUTER_FALLBACK_MODELS;
});
afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
  if (originalModels === undefined)
    delete process.env.OPENROUTER_FALLBACK_MODELS;
  else process.env.OPENROUTER_FALLBACK_MODELS = originalModels;
});
const model = (id, extra = {}) => ({
  id,
  pricing: { prompt: "0", completion: "0" },
  context_length: 128000,
  supported_parameters: ["tools"],
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  ...extra,
});
const reply = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const answer = () =>
  reply({
    model: "actual/free-model",
    choices: [{ message: { content: "Baik" }, finish_reason: "stop" }],
  });
const messages = [{ role: "user", parts: [{ text: "Catat makan 20 ribu" }] }];
const tools = [
  {
    type: "function",
    function: { name: "log_transaction", parameters: { type: "object" } },
  },
];
function fixture(models, respond = answer, policy) {
  const calls = [];
  let catalogs = 0;
  const request = createFreeRouter(async (url, init) => {
    if (url.endsWith("/models")) {
      catalogs++;
      return reply({ data: models });
    }
    const body = JSON.parse(init.body);
    calls.push(body);
    return respond(body, calls.length, init);
  }, policy);
  return { request, calls, catalogs: () => catalogs };
}

test("paid, unknown-price, non-text and tool-incompatible models cannot be selected even via env", async () => {
  process.env.OPENROUTER_FALLBACK_MODELS =
    "paid,half-free,unknown,text-only,image-output,free";
  const f = fixture([
    model("paid", { pricing: { prompt: "1", completion: "1" } }),
    model("half-free", { pricing: { prompt: "0", completion: "1" } }),
    model("unknown", { pricing: { prompt: "0", completion: null } }),
    model("text-only", { supported_parameters: [] }),
    model("image-output", { architecture: { output_modalities: ["image"] } }),
    model("free"),
  ]);
  const result = await f.request(messages, "system", tools);
  assert.equal(f.calls[0].model, "free");
  assert.deepEqual(f.calls[0].tools, tools);
  assert.deepEqual(f.calls[0].provider.max_price, {
    prompt: 0,
    completion: 0,
    request: 0,
    image: 0,
  });
  assert.equal(f.calls[0].provider.require_parameters, true);
  assert.equal(result.modelUsed, "actual/free-model");
});

test("vision requires both images and tools; briefs allow text models without tools", async () => {
  process.env.OPENROUTER_FALLBACK_MODELS = "text,vision-no-tools,vision";
  const f = fixture([
    model("text", { supported_parameters: [] }),
    model("vision-no-tools", {
      supported_parameters: [],
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    }),
    model("vision", {
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    }),
  ]);
  const image = "data:image/png;base64,aGVsbG8=";
  await f.request(
    [{ role: "user", parts: [{ text: "Foto" }, { inlineData: image }] }],
    "system",
    tools,
  );
  assert.equal(f.calls[0].model, "vision");
  assert.equal(f.calls[0].messages[1].content[1].image_url.url, image);
  await f.request(messages, "system", tools, { tools: false, maxTokens: 512 });
  assert.equal(f.calls[1].model, "text");
  assert.equal(f.calls[1].tools, undefined);
  assert.equal(f.calls[1].max_tokens, 512);
  assert.equal(f.catalogs(), 1);
});

test("fallback attempts are capped, with the free router always last", async () => {
  const f = fixture(
    ["a", "b", "c", "d"].map((id) => model(id)),
    () => reply({ error: { message: "Unavailable" } }, 503),
  );
  await assert.rejects(f.request(messages, "system", tools), AIProviderError);
  assert.deepEqual(
    f.calls.map((c) => c.model),
    ["a", "b", "openrouter/free"],
  );
  assert.ok(
    f.calls.every(
      (c) => c.tools.length && c.provider.max_price.completion === 0,
    ),
  );
});

test("cooldown honors Retry-After, allowing another compatible free model", async () => {
  const f = fixture(
    ["a", "b"].map((id) => model(id)),
    (body) =>
      body.model === "a"
        ? reply({ error: { code: 429 } }, 429, { "Retry-After": "120" })
        : answer(),
  );
  await f.request(messages, "system", tools);
  await f.request(messages, "system", tools);
  assert.deepEqual(
    f.calls.map((c) => c.model),
    ["a", "b", "b"],
  );
});

test("daily account limits and invalid credentials stop immediately", async () => {
  for (const [status, detail] of [
    [429, "Free models daily limit exceeded"],
    [401, "Bad key"],
    [403, "Denied"],
  ]) {
    const f = fixture(
      ["a", "b"].map((id) => model(id)),
      () => reply({ error: { code: status, message: detail } }, status),
    );
    await assert.rejects(
      f.request(messages, "system", tools),
      (error) =>
        error instanceof AIProviderError &&
        (status !== 429 || error.statusCode === 429),
    );
    assert.equal(f.calls.length, 1);
  }
});

test("malformed tool arguments, truncated and empty responses fall back before any action", async () => {
  for (const choice of [
    {
      message: {
        tool_calls: [
          { function: { name: "log_transaction", arguments: '{"amount":' } },
        ],
      },
    },
    {
      message: {
        tool_calls: [{ function: { name: "unknown", arguments: "{}" } }],
      },
    },
    { message: { content: "partial" }, finish_reason: "length" },
    { message: { content: "" } },
  ]) {
    const f = fixture(
      ["a", "b"].map((id) => model(id)),
      (_, n) => (n === 1 ? reply({ choices: [choice] }) : answer()),
    );
    const result = await f.request(messages, "system", tools);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(result.candidates[0].content.parts, [{ text: "Baik" }]);
  }
});

test("valid tool arguments are preserved and paid image/request pricing is excluded", async () => {
  const args = { amount: 20000, type: "expense", category: "food" };
  const f = fixture(
    [
      model("a", {
        pricing: { prompt: "0", completion: "0", request: "0.01" },
      }),
      model("b", { pricing: { prompt: "0", completion: "0", image: "0.01" } }),
      model("c"),
    ],
    () =>
      reply({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: "log_transaction",
                    arguments: JSON.stringify(args),
                  },
                },
              ],
            },
          },
        ],
      }),
  );
  const result = await f.request(messages, "system", tools);
  assert.equal(f.calls[0].model, "c");
  assert.deepEqual(
    result.candidates[0].content.parts[0].functionCall.args,
    args,
  );
});

test("catalog failure uses only the free router and coalesces concurrent refreshes", async () => {
  let catalogs = 0;
  const calls = [];
  const request = createFreeRouter(async (url, init) => {
    if (url.endsWith("/models")) {
      catalogs++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw Error("offline");
    }
    calls.push(JSON.parse(init.body));
    return answer();
  });
  await Promise.all([
    request(messages, "system", tools),
    request(messages, "system", tools),
  ]);
  assert.equal(catalogs, 1);
  assert.ok(calls.every((c) => c.model === "openrouter/free"));
});

test("a slow model is aborted and the next free model can answer", async () => {
  const f = fixture(
    ["a", "b"].map((id) => model(id)),
    (_, n, init) =>
      n === 1
        ? new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error("timeout was not enforced")),
              200,
            );
            init.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                reject(init.signal.reason);
              },
              { once: true },
            );
          })
        : answer(),
    { attemptMs: 10, catalogMs: 10, totalMs: 100 },
  );
  await f.request(messages, "system", tools);
  assert.deepEqual(
    f.calls.map((c) => c.model),
    ["a", "b"],
  );
});

test("expired shared deadline makes no provider calls", async () => {
  const f = fixture([model("a")]);
  await assert.rejects(
    f.request(messages, "system", tools, { deadline: Date.now() - 1 }),
    AIProviderError,
  );
  assert.equal(f.calls.length, 0);
  assert.equal(f.catalogs(), 0);
});

test("history keeps recent messages in order, caps size and reports missing turns", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: String(i) + "x".repeat(3000),
  }));
  const result = compactHistory(rows);
  assert.equal(result.history[0].role, "user");
  assert.ok(result.history.at(-1).parts[0].text.startsWith("19"));
  assert.ok(
    result.history.reduce((n, m) => n + m.parts[0].text.length, 0) <= 16000,
  );
  assert.ok(result.omitted > 0);
  assert.equal(rows.length, 20);
});

test("life context remains bounded valid JSON with IDs, newest logs and omission counts", () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({
    id: `id-${i}`,
    title: "x".repeat(5000),
    user_id: "private-id",
    created_at: "2026-10-23",
  }));
  const context = compactLifeContext({
    date: "2026-10-23",
    tasks: rows,
    events: rows,
    plan: { items: rows },
    logs: [
      { id: "old", date: "2026-10-01" },
      { id: "new", date: "2026-10-23" },
    ],
  });
  const json = JSON.stringify(context);
  assert.ok(json.length <= 12000);
  assert.ok(!json.includes("private-id"));
  assert.ok(context.tasks.every((t) => t.id.startsWith("id-")));
  assert.equal(context.recent_logs[0].id, "new");
  assert.equal(context.omitted.tasks, 80 - context.tasks.length);
  assert.match(context.notice, /get_life_context/);
  assert.equal(rows[0].title.length, 5000);
});

test("context preserves PostgreSQL timestamp Date values and sorts logs by logged_at", () => {
  const timestamp = new Date("2026-10-23T03:00:00Z");
  const context = compactLifeContext({
    events: [{ id: "event", start_time: timestamp }],
    logs: [
      {
        id: "later",
        date: "2026-10-23",
        logged_at: "2026-10-23T10:00:00Z",
        created_at: "2026-10-23T02:00:00Z",
      },
      {
        id: "earlier",
        date: "2026-10-23",
        logged_at: "2026-10-23T01:00:00Z",
        created_at: "2026-10-23T11:00:00Z",
      },
    ],
  });
  assert.equal(context.events[0].start_time, timestamp.toISOString());
  assert.equal(context.recent_logs[0].id, "later");
});

test("401 and 403 errors have distinct causes and do not invalidate the application session", async () => {
  for (const [httpStatus, error, expectedCode] of [
    [401, { message: "User not found" }, "OPENROUTER_AUTH"],
    [403, { message: "Denied" }, "OPENROUTER_FORBIDDEN"],
    [
      403,
      { message: "No endpoints matching your data policy" },
      "OPENROUTER_PRIVACY",
    ],
    [
      403,
      {
        message: "Budget exceeded",
        metadata: { limit_source: "openrouter_key_limit" },
      },
      "OPENROUTER_BUDGET",
    ],
    [403, { message: "Request blocked by guardrail" }, "OPENROUTER_POLICY"],
    [200, { code: 401, message: "Invalid credentials" }, "OPENROUTER_AUTH"],
    [
      200,
      { code: 403, message: "Request blocked by moderation" },
      "OPENROUTER_POLICY",
    ],
  ]) {
    const f = fixture(
      ["a", "b"].map((id) => model(id)),
      () => reply({ error }, httpStatus),
    );
    await assert.rejects(f.request(messages, "system", tools), (e) => {
      assert.equal(e.reasonCode, expectedCode);
      assert.equal(e.statusCode, 502); // The browser logs out on application 401.
      assert.match(e.message, /401|403/);
      return true;
    });
    assert.equal(f.calls.length, 1); // Forbidden requests never bypass policies through fallback.
  }
});

test("non-JSON authentication failures remain actionable instead of retrying other models", async () => {
  for (const status of [401, 403]) {
    const f = fixture(
      ["a", "b"].map((id) => model(id)),
      () => new Response("Forbidden", { status }),
    );
    await assert.rejects(
      f.request(messages, "system", tools),
      (e) =>
        e.reasonCode ===
        (status === 401 ? "OPENROUTER_AUTH" : "OPENROUTER_FORBIDDEN"),
    );
    assert.equal(f.calls.length, 1);
  }
});

test("diagnostic logs omit raw provider messages, prompts and credentials", async () => {
  const secret = "sk-or-test-private";
  const f = fixture([model("a")], () =>
    reply(
      {
        error: {
          code: 403,
          message: "Denied " + secret,
          metadata: {
            raw: "Private prompt: " + secret,
            provider_name: "Provider",
            error_type: "permission_error",
          },
        },
      },
      403,
    ),
  );
  await assert.rejects(f.request(messages, "private prompt", tools));
  const logged = JSON.stringify(console.warn.mock.calls);
  assert.ok(!logged.includes(secret));
  assert.ok(!logged.includes("private prompt"));
  assert.ok(!logged.includes("Authorization"));
  assert.match(logged, /permission_error/);
});

test("leading and trailing environment whitespace is removed before authorization", async () => {
  process.env.OPENROUTER_API_KEY = "  test-key\n";
  const f = fixture([model("a")], (_, __, init) => {
    assert.equal(init.headers.Authorization, "Bearer test-key");
    return answer();
  });
  await f.request(messages, "system", tools);
});
