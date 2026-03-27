export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      route: 'chat working',
      method: 'GET'
    });
  }

  const body = req.body || {};
  const action = body.action;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  function requireEnv(keys) {
    for (const key of keys) {
      if (key === 'SUPABASE_URL' && !SUPABASE_URL) return 'SUPABASE_URL mancante';
      if (key === 'SUPABASE_KEY' && !SUPABASE_KEY) return 'SUPABASE_KEY mancante';
      if (key === 'SUPABASE_SERVICE_KEY' && !SUPABASE_SERVICE_KEY) return 'SUPABASE_SERVICE_KEY mancante';
      if (key === 'ADMIN_PASSWORD' && !ADMIN_PASSWORD) return 'ADMIN_PASSWORD mancante';
      if (key === 'ANTHROPIC_API_KEY' && !ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY mancante';
    }
    return null;
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  try {
    if (action === 'admin') {
      const envError = requireEnv([
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'ADMIN_PASSWORD'
      ]);
      if (envError) {
        return res.status(500).json({ error: envError });
      }

      if (body.adminPw !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Non autorizzato' });
      }

      const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_users_overview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({})
      });

      const users = await safeJson(usersRes);

      if (!usersRes.ok) {
        return res.status(400).json({
          error: users?.message || 'Errore lettura utenti admin',
          details: users
        });
      }

      return res.status(200).json({
        users: Array.isArray(users) ? users : []
      });
    }

    if (action === 'signup') {
      const envError = requireEnv([
        'SUPABASE_URL',
        'SUPABASE_KEY',
        'SUPABASE_SERVICE_KEY'
      ]);
      if (envError) {
        return res.status(500).json({ error: envError });
      }

      const { email, password, profile } = body.data || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e password obbligatorie' });
      }

      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const signupData = await safeJson(signupRes);

      if (!signupRes.ok || signupData?.error) {
        return res.status(400).json({
          error:
            signupData?.error_description ||
            signupData?.msg ||
            signupData?.message ||
            'Signup failed',
          details: signupData
        });
      }

      const userId = signupData?.user?.id;

      if (!userId) {
        return res.status(400).json({
          error: 'Email già registrata oppure risposta Auth obfuscata da Supabase',
          details: signupData
        });
      }

      const profilePayload = {
        id: userId,
        em: email,
        ...(profile || {})
      };

      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(profilePayload)
      });

      const profileData = await safeJson(profileRes);

      if (!profileRes.ok) {
        return res.status(400).json({
          error: profileData?.message || 'Profilo non creato',
          details: profileData
        });
      }

      return res.status(200).json({
        ok: true,
        userId,
        profile: Array.isArray(profileData) ? profileData[0] || null : profileData
      });
    }

    if (action === 'signin') {
      const envError = requireEnv([
        'SUPABASE_URL',
        'SUPABASE_KEY',
        'SUPABASE_SERVICE_KEY'
      ]);
      if (envError) {
        return res.status(500).json({ error: envError });
      }

      const { email, password } = body.data || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e password obbligatorie' });
      }

      const signinRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const signinData = await safeJson(signinRes);

      if (!signinRes.ok || signinData?.error) {
        return res.status(400).json({
          error:
            signinData?.error_description ||
            signinData?.msg ||
            signinData?.message ||
            'Login failed',
          details: signinData
        });
      }

      if (signinData?.user?.id) {
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(signinData.user.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ last_login: new Date().toISOString() })
        }).catch(() => {});
      }

      return res.status(200).json({
        ok: true,
        token: signinData?.access_token || null,
        userId: signinData?.user?.id || null
      });
    }

    if (action === 'db') {
      const envError = requireEnv(['SUPABASE_URL', 'SUPABASE_KEY']);
      if (envError) {
        return res.status(500).json({ error: envError });
      }

      const { table, method, filter, values, onConflict } = body.data || {};
      const token = body.token || SUPABASE_KEY;

      if (!table || !method) {
        return res.status(400).json({ error: 'table e method obbligatori' });
      }

      let url = `${SUPABASE_URL}/rest/v1/${table}`;
      const headers = {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: 'return=representation'
      };

      if (method === 'select') {
        const params = new URLSearchParams();
        params.set('select', '*');

        if (filter) {
          Object.entries(filter).forEach(([k, v]) => {
            params.set(k, `eq.${v}`);
          });
        }

        url += `?${params.toString()}`;

        const dbRes = await fetch(url, { method: 'GET', headers });
        const result = await safeJson(dbRes);

        if (!dbRes.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore select database',
            details: result
          });
        }

        return res.status(200).json({ result: Array.isArray(result) ? result : [] });
      }

      if (method === 'upsert') {
        const params = new URLSearchParams();
        if (onConflict) params.set('on_conflict', onConflict);
        if (params.toString()) url += `?${params.toString()}`;

        headers.Prefer = 'resolution=merge-duplicates,return=representation';

        const dbRes = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(values)
        });

        const result = await safeJson(dbRes);

        if (!dbRes.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore upsert database',
            details: result
          });
        }

        return res.status(200).json({
          result: Array.isArray(result) ? result : (result ? [result] : [])
        });
      }

      if (method === 'insert') {
        const dbRes = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(values)
        });

        const result = await safeJson(dbRes);

        if (!dbRes.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore insert database',
            details: result
          });
        }

        return res.status(200).json({
          result: Array.isArray(result) ? result : (result ? [result] : [])
        });
      }

      if (method === 'update') {
        const params = new URLSearchParams();
        params.set('select', '*');

        if (filter) {
          Object.entries(filter).forEach(([k, v]) => {
            params.set(k, `eq.${v}`);
          });
        }

        url += `?${params.toString()}`;

        const dbRes = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(values)
        });

        const result = await safeJson(dbRes);

        if (!dbRes.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore update database',
            details: result
          });
        }

        return res.status(200).json({
          result: Array.isArray(result) ? result : (result ? [result] : [])
        });
      }

      return res.status(400).json({ error: 'Metodo database non riconosciuto' });
    }

    if (body.payload) {
      const envError = requireEnv(['ANTHROPIC_API_KEY']);
      if (envError) {
        return res.status(500).json({ error: envError });
      }

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': ANTHROPIC_API_KEY
        },
        body: JSON.stringify(body.payload)
      });

      const aiData = await safeJson(aiRes);

      if (!aiRes.ok) {
        return res.status(400).json({
          error: aiData?.error?.message || aiData?.error || 'Errore Anthropic',
          details: aiData
        });
      }

      return res.status(200).json(aiData);
    }

    return res.status(400).json({ error: 'Azione non riconosciuta' });
  } catch (e) {
    console.error('CHAT API ERROR:', e);
    return res.status(500).json({
      error: e?.message || 'Errore server'
    });
  }
}
