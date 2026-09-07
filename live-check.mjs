const BASE = 'https://jade-alfajores-76f3dd.netlify.app';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  const text = await r.text();
  return { status: r.status, text: text.slice(0, 400) };
}

(async () => {
  const home = await req('/');
  console.log('HOME:', home.status, home.text.includes('<div id="root">') ? 'REACT-APP-OK' : home.text.slice(0, 120));

  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tes2@tes.com', password: 'pass123' }),
  });
  console.log('LOGIN:', login.status, login.text.slice(0, 150));

  let token = null;
  try { token = JSON.parse(login.text).token; } catch {}

  if (token) {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // 1. Buat conversation baru
    const conv = await req('/api/data/ai_conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Live test' }),
    });
    console.log('CONV:', conv.status, conv.text.slice(0, 120));
    let convId = null;
    try { convId = JSON.parse(conv.text).data?.id; } catch {}

    // 2. Chat ke AI
    if (convId) {
      const chat = await req('/api/ai-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: 'halo, tes koneksi AI', conversation_id: convId }),
      });
      console.log('AI-CHAT:', chat.status, chat.text.slice(0, 500));
    } else {
      console.log('AI-CHAT: SKIPPED (no conv id)');
    }
  } else {
    console.log('AI-CHAT: SKIPPED (no token)');
  }
})();
