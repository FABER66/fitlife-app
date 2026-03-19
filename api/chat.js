export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const body = req.body || {};
  const AKEY = process.env.ANTHROPIC_API_KEY;
  const SURL = process.env.SUPABASE_URL;
  const SKEY = process.env.SUPABASE_KEY;

  try {

    // ===== REGISTRAZIONE =====
    if (body.action === 'signup') {
      const { email, password, profile } = body.data;
      const r1 = await fetch(SURL + '/auth/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SKEY },
        body: JSON.stringify({ email, password })
      });
      const a1 = await r1.json();
      if (a1.error) return res.json({ error: a1.error.message });
      const uid = a1.user && a1.user.id;
      if (uid) {
        await fetch(SURL + '/rest/v1/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SKEY,
            'Authorization': 'Bearer ' + SKEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ id: uid, em: email, ...profile })
        });
      }
      return res.json({ userId: uid });
    }

    // ===== LOGIN =====
    if (body.action === 'signin') {
      const { email, password } = body.data;
      const r2 = await fetch(SURL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SKEY },
        body: JSON.stringify({ email, password })
      });
      const a2 = await r2.json();
      if (a2.error) return res.json({ error: a2.error.message });
      return res.json({ token: a2.access_token, userId: a2.user && a2.user.id });
    }

    // ===== DATABASE =====
    if (body.action === 'db') {
      const { table, method, filter, values } = body.data;
      const tok = body.token || SKEY;
      let url = SURL + '/rest/v1/' + table;
      if (filter) {
        const q = Object.entries(filter).map(function(e) { return e[0] + '=eq.' + e[1]; }).join('&');
        url += '?' + q;
      } else if (method === 'select') {
        url += '?select=*';
      }
      const headers = {
        'Content-Type': 'application/json',
        'apikey': SKEY,
        'Authorization': 'Bearer ' + tok,
        'Prefer': 'return=representation'
      };
      const httpMethod = method === 'select' ? 'GET' : method === 'upsert' ? 'POST' : method === 'insert' ? 'POST' : method === 'update' ? 'PATCH' : 'GET';
      if (method === 'upsert') {
        url = SURL + '/rest/v1/' + table;
        headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
      }
      const r3 = await fetch(url, {
        method: httpMethod,
        headers: headers,
        body: (method !== 'select') ? JSON.stringify(values) : undefined
      });
      const result = await r3.json();
      return res.json({ result: result });
    }

    // ===== AI ANTHROPIC =====
    if (body.payload) {
      const r4 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': AKEY
        },
        body: JSON.stringify(body.payload)
      });
      const ai = await r4.json();
      return res.json(ai);
    }

    return res.json({ error: 'Azione non riconosciuta' });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
