if (!SURL) return res.status(500).json({ error: 'SUPABASE_URL mancante' });
if (!SKEY) return res.status(500).json({ error: 'SUPABASE_KEY mancante' });
if (!SSERVICE) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY mancante' });
if (!ADMIN_PW) return res.status(500).json({ error: 'ADMIN_PASSWORD mancante' });export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const body = req.body || {};
  const AKEY = process.env.ANTHROPIC_API_KEY;
  const SURL = process.env.SUPABASE_URL;
  const SKEY = process.env.SUPABASE_KEY;
  const SSERVICE = process.env.SUPABASE_SERVICE_KEY;
  const ADMIN_PW = process.env.ADMIN_PASSWORD;

  try {

    // ============================================================
    // ADMIN
    // ============================================================
    if (body.action === 'admin') {
      if (body.adminPw !== ADMIN_PW) {
        return res.status(401).json({ error: 'Non autorizzato' });
      }
      const [usersRes, workoutsRes] = await Promise.all([
        fetch(`${SURL}/rest/v1/profiles?select=*`, {
          headers: { apikey: SSERVICE, Authorization: `Bearer ${SSERVICE}` }
        }),
        fetch(`${SURL}/rest/v1/workouts?select=id,user_id`, {
          headers: { apikey: SSERVICE, Authorization: `Bearer ${SSERVICE}` }
        })
      ]);
      const users = await usersRes.json();
      const workouts = await workoutsRes.json();
      return res.json({ users, workouts });
    }

    // ============================================================
    // SIGNUP
    // ============================================================
    if (body.action === 'signup') {
      const { email, password, profile } = body.data || {};

      const r1 = await fetch(`${SURL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SKEY,
          Authorization: `Bearer ${SKEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const a1 = await r1.json();

      if (!r1.ok || a1.error) {
        return res.status(400).json({
          error: a1.error_description || a1.msg || a1.message || 'Signup failed'
        });
      }

      const uid = a1.user && a1.user.id;
      if (!uid) {
        return res.status(400).json({ error: 'Utente non creato correttamente' });
      }

      // prova prima update sul profilo (utile se hai trigger che crea la riga)
      let rProf = await fetch(
        `${SURL}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=*`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SKEY,
            Authorization: `Bearer ${SKEY}`,
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            em: email,
            ...(profile || {})
          })
        }
      );

      let profData = [];
      try {
        profData = await rProf.json();
      } catch (_) {
        profData = [];
      }

      // se non esiste ancora la riga, la crea
      if (!rProf.ok || !Array.isArray(profData) || !profData.length) {
        const rInsert = await fetch(`${SURL}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SKEY,
            Authorization: `Bearer ${SKEY}`,
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            id: uid,
            em: email,
            ...(profile || {})
          })
        });

        const ins = await rInsert.json().catch(() => null);
        if (!rInsert.ok) {
          return res.status(400).json({
            error: ins?.message || 'Profilo non creato'
          });
        }
      }

      return res.json({ userId: uid });
    }

    // ============================================================
    // SIGNIN
    // ============================================================
    if (body.action === 'signin') {
      const { email, password } = body.data || {};

      const r2 = await fetch(`${SURL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SKEY,
          Authorization: `Bearer ${SKEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const a2 = await r2.json();

      if (!r2.ok || a2.error) {
        return res.status(400).json({
          error: a2.error_description || a2.msg || a2.message || 'Login failed'
        });
      }

      // Aggiorna last_login in background
      if (a2.user && a2.user.id) {
        fetch(`${SURL}/rest/v1/profiles?id=eq.${a2.user.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SKEY,
            Authorization: `Bearer ${SKEY}`
          },
          body: JSON.stringify({ last_login: new Date().toISOString() })
        });
      }

      return res.json({
        token: a2.access_token,
        userId: a2.user && a2.user.id
      });
    }

    // ============================================================
    // DATABASE
    // ============================================================
    if (body.action === 'db') {
      const { table, method, filter, values, onConflict } = body.data || {};
      const tok = body.token || SKEY;

      let url = `${SURL}/rest/v1/${table}`;
      const headers = {
        'Content-Type': 'application/json',
        apikey: SKEY,
        Authorization: `Bearer ${tok}`,
        Prefer: 'return=representation'
      };

      // SELECT
      if (method === 'select') {
        const params = new URLSearchParams();
        params.set('select', '*');

        if (filter) {
          Object.entries(filter).forEach(([k, v]) => {
            params.set(k, `eq.${v}`);
          });
        }

        url += `?${params.toString()}`;

        const r3 = await fetch(url, {
          method: 'GET',
          headers
        });

        const result = await r3.json().catch(() => []);

        if (!r3.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore select database',
            result
          });
        }

        return res.json({ result });
      }

      // UPSERT
      if (method === 'upsert') {
        const params = new URLSearchParams();
        if (onConflict) params.set('on_conflict', onConflict);
        if (params.toString()) url += `?${params.toString()}`;

        headers.Prefer = 'resolution=merge-duplicates,return=representation';

        const r3 = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(values)
        });

        const result = await r3.json().catch(() => []);

        if (!r3.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore upsert database',
            result
          });
        }

        return res.json({ result });
      }

      // INSERT
      if (method === 'insert') {
        const r3 = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(values)
        });

        const result = await r3.json().catch(() => []);

        if (!r3.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore insert database',
            result
          });
        }

        return res.json({ result });
      }

      // UPDATE
      if (method === 'update') {
        const params = new URLSearchParams();
        params.set('select', '*');

        if (filter) {
          Object.entries(filter).forEach(([k, v]) => {
            params.set(k, `eq.${v}`);
          });
        }

        url += `?${params.toString()}`;

        const r3 = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(values)
        });

        const result = await r3.json().catch(() => []);

        if (!r3.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore update database',
            result
          });
        }

        return res.json({ result });
      }

      return res.status(400).json({ error: 'Metodo database non riconosciuto' });
    }

    // ============================================================
    // AI ANTHROPIC
    // ============================================================
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

      if (!r4.ok) {
        return res.status(400).json({
          error: ai?.error?.message || ai?.error || 'Errore Anthropic'
        });
      }

      return res.json(ai);
    }

    return res.status(400).json({ error: 'Azione non riconosciuta' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
