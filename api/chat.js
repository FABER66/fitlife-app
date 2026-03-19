export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, payload, token, data } = req.body || {};
  const SURL = process.env.SUPABASE_URL;
  const SKEY = process.env.SUPABASE_KEY;

  // Helper Supabase REST
  async function sb(path, method, body, userToken) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SKEY,
      'Authorization': userToken ? `Bearer ${userToken}` : `Bearer ${SKEY}`
    };
    const r = await fetch(`${SURL}/rest/v1/${path}`, {
      method: method || 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return await r.json();
  }

  // Auth Supabase
  async function sbAuth(path, body) {
    const r = await fetch(`${SURL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SKEY },
      body: JSON.stringify(body)
    });
    return await r.json();
  }

  try {
    // REGISTRAZIONE
    if (action === 'signup') {
      const { email, password, profile } = data;
      const authRes = await sbAuth('signup', { email, password });
      if (authRes.error) return res.status(400).json({ error: authRes.error.message });
      const userId = authRes.user?.id || authRes.id;
      if (userId) {
        await fetch(`${SURL}/rest/v1/profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SKEY, 'Authorization': `Bearer ${SKEY}`, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ id: userId, em: email, ...profile })
        });
      }
      return res.status(200).json({ userId });
    }

    // LOGIN
    if (action === 'signin') {
      const { email, password } = data;
      const authRes = await sbAuth('token?grant_type=password', { email, password });
      if (authRes.error) return res.status(400).json({ error: authRes.error.message });
      return res.status(200).json({
        token: authRes.access_token,
        userId: authRes.user?.id
      });
    }

    // OPERAZIONI DB
    if (action === 'db') {
      const { table, method, filter, values } = data;
      let path = table;
      if (filter) {
        const params = Object.entries(filter).map(([k,v]) => `${k}=eq.${v}`).join('&');
        path += '?' + params;
      }
      if (method === 'select') {
        if (!filter) path += '?select=*';
        const result = await sb(path, 'GET', null, token);
        return res.status(200).json({ result });
      }
      if (method === 'upsert') {
        const result = await sb(table + '?on_conflict=user_id,data', 'POST', values, token);
        return res.status(200).json({ result });
      }
      if (method === 'insert') {
        const result = await sb(table, 'POST', values, token);
        return res.status(200).json({ result });
      }
      if (method === 'update') {
        const result = await sb(path, 'PATCH', values, token);
        return res.status(200).json({ result });
      }
    }

    // CHIAMATA AI ANTHROPIC
    if (payload) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      return res.status(200).json(result);
    }

    res.status(400).json({ error: 'Azione non riconosciuta' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
