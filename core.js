// PROXY AI - usa Vercel server, fallback diretto
async function callAI(key, payload) {
  // Usa sempre il proxy Vercel - nessuna key richiesta all utente
  var r = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({payload: payload})
  });
  var d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}


// DATABASE - Supabase + localStorage fallback
var DB = 'fl5';
var AUTH_TOKEN = null;
var USER_ID = null;

function loadDB() {
  try { var d = localStorage.getItem(DB); return d ? JSON.parse(d) : {users:[], logs:{}, workouts:[]}; }
  catch(e) { return {users:[], logs:{}, workouts:[]}; }
}
function saveDB(d) {
  try { localStorage.setItem(DB, JSON.stringify(d)); }
  catch(e) {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2,4); }
function dkey(d) { return d.toISOString().split('T')[0]; }
function fmtD(s) {
  var d = new Date(s + 'T12:00:00'), o = dkey(new Date());
  if (s === o) return 'Oggi';
  var y = new Date(Date.now() - 86400000);
  if (s === dkey(y)) return 'Ieri';
  return d.toLocaleDateString('it-IT', {weekday:'short', day:'numeric', month:'short'});
}


function safeInitials(nm, cg) {
  return (((nm || '?').charAt(0)) + ((cg || '?').charAt(0))).toUpperCase();
}

function normalizeLog(log) {
  log = log || {};
  var pasti = log.pasti || {};
  return {
    pasti: {
      Colazione: Array.isArray(pasti.Colazione) ? pasti.Colazione : [],
      Pranzo: Array.isArray(pasti.Pranzo) ? pasti.Pranzo : [],
      Cena: Array.isArray(pasti.Cena) ? pasti.Cena : [],
      Spuntino: Array.isArray(pasti.Spuntino) ? pasti.Spuntino : []
    },
    kcalBruciate: Number(log.kcalBruciate || 0),
    peso: Number(log.peso || 0)
  };
}

function normalizeUser(u) {
  if (!u) return null;
  var nu = Object.assign({}, u);
  nu.nm = nu.nm || '';
  nu.cg = nu.cg || '';
  nu.schede = Array.isArray(nu.schede) && nu.schede.length ? nu.schede : [{id:'A',nm:'Scheda A',ex:[]},{id:'B',nm:'Scheda B',ex:[]}];
  nu.actS = nu.actS || nu.act_s || (nu.schede[0] ? nu.schede[0].id : 'A');
  nu.apiKey = nu.apiKey || '';
  return nu;
}

function saveSession(uid, token) {
  if (uid) localStorage.setItem('fl5_uid', uid); else localStorage.removeItem('fl5_uid');
  if (token) localStorage.setItem('fl5_token', token); else localStorage.removeItem('fl5_token');
}

function clearSession() {
  localStorage.removeItem('fl5_uid');
  localStorage.removeItem('fl5_token');
}

async function hashPassword(pw) {
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) return 'plain:' + pw;
  var data = new TextEncoder().encode('fl5|' + pw);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}

function upsertLocalUser(user) {
  var db = loadDB();
  if (!Array.isArray(db.users)) db.users = [];
  var normalized = normalizeUser(user);
  var i = db.users.findIndex(function(u) { return u.id === normalized.id; });
  if (i >= 0) db.users[i] = Object.assign({}, db.users[i], normalized);
  else db.users.push(normalized);
  saveDB(db);
}

function getLocalUserById(id) {
  var db = loadDB();
  var u = (db.users || []).find(function(x) { return x.id === id; });
  return normalizeUser(u);
}

async function findLocalUserByCredentials(em, pw) {
  var db = loadDB();
  var hashed = await hashPassword(pw);
  var u = (db.users || []).find(function(x) {
    return x.em === em && (x.pwHash === hashed || x.pw === pw);
  });
  if (u && !u.pwHash && u.pw === pw) {
    u.pwHash = hashed;
    delete u.pw;
    saveDB(db);
  }
  return normalizeUser(u);
}

function resetTimer() {
  clearInterval(state.workout.timer.intervalId);
  state.workout.timer.intervalId = null;
  state.workout.timer.running = false;
  state.workout.timer.seconds = 0;
  var tf = document.getElementById('tfab');
  var td = document.getElementById('tdisp');
  if (tf) tf.className = 'tfab';
  if (td) td.textContent = '00:00';
}

function getWorkouts(uid) {
  var db = loadDB();
  var ws = Array.isArray(db.workouts) ? db.workouts : [];
  return ws.filter(function(w) { return w.uid === uid; })
    .sort(function(a, b) { return new Date(b.dt) - new Date(a.dt); });
}

function addWorkout(rec) {
  var db = loadDB();
  if (!Array.isArray(db.workouts)) db.workouts = [];
  db.workouts.unshift(rec);
  saveDB(db);
}

function getLatestPeso(uid, days) {
  for (var i = 0; i < (days || 30); i++) {
    var dt = new Date();
    dt.setDate(dt.getDate() - i);
    var lg = getLog(uid, dkey(dt));
    if (lg.peso) return lg.peso;
  }
  return 0;
}

function tempoToMinutes(v) {
  var txt = String(v || '').toLowerCase().replace(',', '.').trim();
  var num = parseFloat(txt) || 0;
  if (!num) return 0;
  if (txt.indexOf('sec') >= 0) return num / 60;
  return num;
}

async function hydrateLogsFromServer(userId) {
  if (!AUTH_TOKEN || !userId) return;
  try {
    var res = await dbCall('db', {table:'logs', method:'select', filter:{user_id:userId}});
    if (!res || !Array.isArray(res.result) || !res.result.length) return;
    var db = loadDB();
    if (!db.logs) db.logs = {};
    res.result.forEach(function(row) {
      if (!row || !row.data) return;
      db.logs[userId + '_' + row.data] = normalizeLog({
        pasti: row.pasti,
        kcalBruciate: row.kcal_bruciate,
        peso: row.peso
      });
    });
    saveDB(db);
  } catch(e) {}
}

// Chiamata al server per operazioni DB
async function dbCall(action, data) {
  try {
    var body = {action: action, data: data};
    if (AUTH_TOKEN) body.token = AUTH_TOKEN;
    var r = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    var result = await r.json();
    if (result.error) throw new Error(result.error);
    return result;
  } catch(e) {
    console.error('DB error:', e.message);
    return null;
  }
}


// FABBISOGNO - Mifflin-St Jeor + lavoro + TEF
function calcFab(sx, ps, al, et, at, ob, lav) {
  var bmr = sx === 'M' ? 10*ps + 6.25*al - 5*et + 5 : 10*ps + 6.25*al - 5*et - 161;
  var tdee = bmr * parseFloat(at || 1.55);
  var bonusLav = lav === 'piedi' ? 300 : lav === 'fisico' ? 600 : 0;
  tdee += bonusLav;
  if (ob === 'dimagrire') tdee -= 500;
  if (ob === 'massa') tdee += 300;
  var tef = Math.round(tdee * 0.10);
  return {
    kc: Math.round(tdee),
    pr: Math.round(ps * 1.8),
    cb: Math.round(tdee * 0.45 / 4),
    gr: Math.round(tdee * 0.25 / 9),
    bmr: Math.round(bmr),
    tdee: Math.round(bmr * parseFloat(at || 1.55)),
    bonusLav: bonusLav,
    tef: tef
  };
}
