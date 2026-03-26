export default async function handler(req, res) {
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
  const SKEY = process.env.SUPABASE_KEY; // anon/public key
  const SSERVICE = process.env.SUPABASE_SERVICE_KEY; // service_role key
  const ADMIN_PW = process.env.ADMIN_PASSWORD;

  function firstError() {
    if (!SURL) return 'SUPABASE_URL mancante';
    if (!SKEY) return 'SUPABASE_KEY mancante';
    if (!SSERVICE) return 'SUPABASE_SERVICE_KEY mancante';
    if (!ADMIN_PW) return 'ADMIN_PASSWORD mancante';
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
    const envError = firstError();
    if (envError) {
      return res.status(500).json({ error: envError });
    }

    // ============================================================
    // ADMIN
    // ============================================================
    if (body.action === 'admin') {
      if (body.adminPw !== ADMIN_PW) {
        return res.status(401).json({ error: 'Non autorizzato' });
      }

      const [usersRes, workoutsRes] = await Promise.all([
        fetch(`${SURL}/rest/v1/profiles?select=*`, {
          headers: {
            apikey: SSERVICE,
            Authorization: `Bearer ${SSERVICE}`
          }
        }),
        fetch(`${SURL}/rest/v1/workouts?select=id,user_id`, {
          headers: {
            apikey: SSERVICE,
            Authorization: `Bearer ${SSERVICE}`
          }
        })
      ]);

      const users = await safeJson(usersRes);
      const workouts = await safeJson(workoutsRes);

      if (!usersRes.ok) {
        return res.status(400).json({
          error: users?.message || 'Errore lettura profiles',
          details: users
        });
      }

      if (!workoutsRes.ok) {
        return res.status(400).json({
          error: workouts?.message || 'Errore lettura workouts',
          details: workouts
        });
      }

      return res.status(200).json({
        users: Array.isArray(users) ? users : [],
        workouts: Array.isArray(workouts) ? workouts : []
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

      const uid = signupData?.user?.id;
      if (!uid) {
        return res.status(400).json({
          error: 'Utente creato ma id non disponibile',
          details: signupData
        });
      }

      const profilePayload = {
        id: uid,
        em: email,
        ...(profile || {})
      };

      // Scrive il profilo con service_role per bypassare eventuale RLS
      const profileRes = await fetch(`${SURL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SSERVICE,
          Authorization: `Bearer ${SSERVICE}`,
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
        userId: uid,
        profile: Array.isArray(profileData) ? (profileData[0] || null) : profileData
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

      const loginRes = await fetch(`${SURL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SKEY,
          Authorization: `Bearer ${SKEY}`
        },
        body: JSON.stringify({ email, password })
      });

      const loginData = await safeJson(loginRes);

      if (!loginRes.ok || loginData?.error) {
        return res.status(400).json({
          error:
            loginData?.error_description ||
            loginData?.msg ||
            loginData?.message ||
            'Login failed',
          details: loginData
        });
      }

      if (loginData?.user?.id) {
        fetch(`${SURL}/rest/v1/profiles?id=eq.${encodeURIComponent(loginData.user.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SSERVICE,
            Authorization: `Bearer ${SSERVICE}`
          },
          body: JSON.stringify({ last_login: new Date().toISOString() })
        }).catch(() => {});
      }

      return res.status(200).json({
        ok: true,
        token: loginData?.access_token || null,
        userId: loginData?.user?.id || null
      });
    }

    // ============================================================
    // DATABASE
    // ============================================================
    if (body.action === 'db') {
      const { table, method, filter, values, onConflict } = body.data || {};
      const tok = body.token || SKEY;

      if (!table || !method) {
        return res.status(400).json({ error: 'table e method obbligatori' });
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

        const dbRes = await fetch(url, {
          method: 'GET',
          headers
        });

        const result = await safeJson(dbRes);

        if (!dbRes.ok) {
          return res.status(400).json({
            error: result?.message || 'Errore select database',
            details: result
          });
        }

        return res.status(200).json({
          result: Array.isArray(result) ? result : []
        });
      }

      // UPSERT
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

      // INSERT
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
