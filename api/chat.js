import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, payload, token, data } = req.body;

  // Azioni database
  if (action === 'db') {
    try {
      const client = token
        ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          })
        : supabase;

      const { table, method, filter, values } = data;
      let query = client.from(table);

      if (method === 'select') {
        query = query.select('*');
        if (filter) query = query.match(filter);
      } else if (method === 'upsert') {
        query = query.upsert(values);
      } else if (method === 'insert') {
        query = query.insert(values);
      } else if (method === 'update') {
        query = query.update(values);
        if (filter) query = query.match(filter);
      } else if (method === 'delete') {
        query = query.delete();
        if (filter) query = query.match(filter);
      }

      const { data: result, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ result });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Autenticazione
  if (action === 'signup') {
    const { email, password, profile } = data;
    const { data: authData, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (error) return res.status(400).json({ error: error.message });
    const userId = authData.user.id;
    await supabase.from('profiles').insert({ id: userId, em: email, ...profile });
    return res.status(200).json({ userId });
  }

  if (action === 'signin') {
    const { email, password } = data;
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({
      token: authData.session.access_token,
      userId: authData.user.id
    });
  }

  // Chiamata AI Anthropic
  try {
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
    res.status(200).json(result);
  } catch(e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
