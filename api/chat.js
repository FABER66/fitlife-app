export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const body = req.body || {};

  const AKEY = process.env.ANTHROPIC_API_KEY;
  const SURL = process.env.SUPABASE_URL;
  const SKEY = process.env.SUPABASE_KEY; // anon/public key
  const SSERVICE = process.env.SUPABASE_SERVICE_KEY; // service role key
  const ADMIN_PW = process.env.ADMIN_PASSWORD;

  const parseJsonSafe = async (response) => {
    const text = await response.text();
    try {
      return { text, data: JSON.parse(text) };
    } catch {
      return { text, data: null };
    }
  };

  try {
    if (!SURL) return res.status(500).json({ error: 'SUPABASE_URL mancante' });
    if (!SKEY) return res.status(500).json({ error: 'SUPABASE_KEY mancante' });
    if (!SSERVICE) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY mancante' });
    if (!ADMIN_PW) return res.status(500).json({ error: 'ADMIN_PASSWORD mancante' });

    // ============================================================
    // ADMIN
    // ============================================================
    if (body.action === 'admin') {
      if (body.adminPw !== ADMIN_PW) {
        return res.status(401).json({ error: 'Non autorizzato' });
      }

      const [usersRes, workoutsRes] = await Promise.all([
        fetch(`${SURL}/rest/v1/profiles?select=*`, {
          method: 'GET',
          headers: {
            apikey: SSERVICE,
            Authorization: `Bearer ${SSERVICE}`
          }
        }),
        fetch(`${SURL}/rest/v1/workouts?select=id,user_id`, {
          method: 'GET',
          headers: {
            apikey: SSERVICE,
            Authorization: `Bearer ${SSERVICE}`
          }
        })
      ]);

      const usersParsed = await parseJsonSafe(usersRes);
      const workoutsParsed = await parseJsonSafe(workoutsRes);

      if (!usersRes.ok) {
        return res.status(usersRes.status).json({
          error: 'Errore lettura profiles',
          details: usersParsed.data || usersParsed.text
        });
      }

      if (!workoutsRes.ok) {
        return res.status(workoutsRes.status).json({
          error: 'Errore lettura workouts',
          details: workoutsParsed.data || workoutsParsed.text
        });
      }

      return res.json({
        users: Array.isArray(usersParsed.data) ? usersParsed.data : [],
        workouts: Array.isArray(workoutsParsed.data) ? workoutsParsed.data : []
      });
    }

    // ============================================================
    // SIGNUP
    // ============================================================
    if (body.action === 'signup') {
      const { email, password, profile } = body.data || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e password obbligatorie' });
      }

      const signupRes = await fetch(`${SURL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SKEY,
          Authorization: `Bearer ${SKEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const signupParsed = await parseJsonSafe(signupRes);
      const signupData = signupParsed.data || {};

      console.log('SIGNUP STATUS', signupRes.status);
      console.log('SIGNUP RESPONSE', signupData || signupParsed.text);

      if (!signupRes.ok || signupData.error) {
        return res.status(signupRes.status || 400).json({
          error:
            signupData.error_description ||
            signupData.msg ||
            signupData.message ||
            'Signup failed',
          details: signupData || signupParsed.text
        });
      }

      const uid = signupData?.user?.id;
      if (!uid) {
        return res.status(400).json({
          error: 'Utente auth non creato correttamente',
          details: signupData || signupParsed.text
        });
      }

      const profilePayload = {
        id: uid,
        em: email,
        ...(profile || {})
      };

      const profileRes = await fetch(`${SURL}/rest/v1/profiles?on_conflict=id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SSERVICE,
          Authorization: `Bearer ${SSERVICE}`,
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(profilePayload)
      });

      const profileParsed = await parseJsonSafe(profileRes);

      if (!profileRes.ok) {
        return res.status(profileRes.status).json({
          error: 'Utente creato in auth ma profilo non creato',
          userId: uid,
          details: profileParsed.data || profileParsed.text
        });
      }

      return res.json({
        ok: true,
        userId: uid,
        profile: profileParsed.data
      });
    }

    // ============================================================
    // SIGNIN
    // ============================================================
    if (body.action === 'signin') {
      const { email, password } = body.data || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e password obbligatorie' });
      }

      const signinRes = await fetch(`${SURL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SKEY,
          Authorization: `Bearer ${SKEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const signinParsed = await parseJsonSafe(signinRes);
      const signinData = signinParsed.data || {};

      if (!signinRes.ok || signinData.error) {
        return res.status(signinRes.status || 400).json({
          error:
            signinData.error_description ||
            signinData.msg ||
            signinData.message ||
            'Login failed',
          details: signinData || signinParsed.text
        });
      }

      if (signinData?.user?.id) {
        fetch(`${SURL}/rest/v1/profiles?id=eq.${encodeURIComponent(signinData.user.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SSERVICE,
            Authorization: `Bearer ${SSERVICE}`,
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            last_login: new Date().toISOString()
          })
        }).catch((err) => {
          console.error('Errore aggiornamento last_login:', err);
        });
      }

      return res.json({
        ok: true,
        token: signinData.access_token,
        userId: signinData?.user?.id
      });
    }

    // ============================================================
    // DATABASE
    // ============================================================
    if (body.action === 'db') {
      const { table, method, filter, values, onConflict } = body.data || {};
      const tok = body.token || SKEY;

      if (!table || !method) {
        return res.status(400).json({ error: 'Table e method obbligatori' });
      }

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

        const r = await fetch(url, {
          method: 'GET',
          headers
        });

        const parsed = await parseJsonSafe(r);

        if (!r.ok) {
          return res.status(r.status).json({
            error: parsed.data?.message || 'Errore select database',
            details: parsed.data || parsed.text
          });
        }

        return res.json({ result: parsed.data || [] });
      }

      // UPSERT
      if (method === 'upsert') {
        const params = new URLSearchParams();
        if (onConflict) params.set('on_conflict', onConflict);
        if (params.toString()) url += `?${params.toString()}`;

        headers.Prefer = 'resolution=merge-duplicates,return=representation';

        const r = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(values)
        });

        const parsed = await parseJsonSafe(r);

        if (!r.ok) {
          return res.status(r.status).json({
            error: parsed.data?.message || 'Errore upsert database',
            details: parsed.data || parsed.text
          });
        }

        return res.json({ result: parsed.data || [] });
      }

      // INSERT
      if (method === 'insert') {
        const r = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(values)
        });

        const parsed = await parseJsonSafe(r);

        if (!r.ok) {
          return res.status(r.status).json({
            error: parsed.data?.message || 'Errore insert database',
            details: parsed.data || parsed.text
          });
        }

        return res.json({ result: parsed.data || [] });
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

        const r = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(values)
        });

        const parsed = await parseJsonSafe(r);

        if (!r.ok) {
          return res.status(r.status).json({
            error: parsed.data?.message || 'Errore update database',
            details: parsed.data || parsed.text
          });
        }

        return res.json({ result: parsed.data || [] });
      }

      return res.status(400).json({ error: 'Metodo database non riconosciuto' });
    }

    // ============================================================
    // AI ANTHROPIC
    // ============================================================
    if (body.payload) {
      if (!AKEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY mancante' });
      }

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': AKEY
        },
        body: JSON.stringify(body.payload)
      });

      const aiParsed = await parseJsonSafe(aiRes);
      const aiData = aiParsed.data || {};

      if (!aiRes.ok) {
        return res.status(aiRes.status || 400).json({
          error: aiData?.error?.message || aiData?.error || 'Errore Anthropic',
          details: aiData || aiParsed.text
        });
      }

      return res.json(aiData);
    }

    return res.status(400).json({ error: 'Azione non riconosciuta' });
  } catch (e) {
    console.error('API CHAT ERROR:', e);
    return res.status(500).json({
      error: e?.message || 'Errore server'
    });
  }
}
