// DATA LAYER - cache locale + sync server + coda offline
function getPendingOps() {
  try {
    var raw = localStorage.getItem('fl5_pending_ops');
    var ops = raw ? JSON.parse(raw) : [];
    return Array.isArray(ops) ? ops : [];
  } catch(e) {
    return [];
  }
}

function savePendingOps(ops) {
  try { localStorage.setItem('fl5_pending_ops', JSON.stringify(ops || [])); }
  catch(e) {}
}

function enqueuePendingOp(type, payload) {
  var ops = getPendingOps();
  ops.push({ id: uid(), type: type, payload: payload, createdAt: new Date().toISOString() });
  savePendingOps(ops);
  setSyncStatus('queued', 'In coda');
}

async function pushLogToServer(uidValue, date, log) {
  if (!AUTH_TOKEN) return false;
  var normalized = normalizeLog(log);
  var res = await dbCall('db', {
    table: 'logs', method: 'upsert',
    values: {user_id: uidValue, data: date, pasti: normalized.pasti, kcal_bruciate: normalized.kcalBruciate || 0, peso: normalized.peso || 0}
  });
  return !!res;
}

async function pushWorkoutToServer(workout) {
  if (!AUTH_TOKEN) return false;
  var res = await dbCall('db', { table: 'workouts', method: 'upsert', values: workout });
  return !!res;
}

async function pushProfileToServer(user) {
  if (!AUTH_TOKEN || !user) return false;
  var res = await dbCall('db', {
    table: 'profiles', method: 'update',
    filter: {id: user.id},
    values: {nm:user.nm, cg:user.cg, ps:user.ps, al:user.al, at:user.at, ob:user.ob, lav:user.lav, po:user.po, fab:user.fab, schede:user.schede, act_s:user.actS}
  });
  return !!res;
}

function replaceLocalWorkouts(uidValue, items) {
  var db = loadDB();
  if (!Array.isArray(db.workouts)) db.workouts = [];
  db.workouts = db.workouts.filter(function(w) { return w.uid !== uidValue; }).concat(items || []);
  db.workouts.sort(function(a, b) { return new Date(b.dt) - new Date(a.dt); });
  saveDB(db);
}

async function syncLogsFromServer(userId) {
  if (!AUTH_TOKEN || !userId) return false;
  var res = await dbCall('db', {table:'logs', method:'select', filter:{user_id:userId}});
  if (!res || !Array.isArray(res.result)) return false;
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
  return true;
}

async function syncWorkoutsFromServer(userId) {
  if (!AUTH_TOKEN || !userId) return false;
  var res = await dbCall('db', {table:'workouts', method:'select', filter:{uid:userId}});
  if (!res || !Array.isArray(res.result)) return false;
  replaceLocalWorkouts(userId, res.result);
  return true;
}

async function syncPendingOps() {
  if (!AUTH_TOKEN) return false;
  var ops = getPendingOps();
  if (!ops.length) {
    setSyncStatus('ok', navigator.onLine ? 'Sincronizzato' : 'Offline');
    return true;
  }
  setSyncStatus('syncing', 'Sincronizzo...');
  var remaining = [];
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    var ok = false;
    try {
      if (op.type === 'log') ok = await pushLogToServer(op.payload.uid, op.payload.date, op.payload.log);
      if (op.type === 'workout') ok = await pushWorkoutToServer(op.payload.workout);
      if (op.type === 'profile') ok = await pushProfileToServer(op.payload.user);
    } catch(e) {
      ok = false;
    }
    if (!ok) remaining.push(op);
  }
  savePendingOps(remaining);
  setSyncStatus(remaining.length ? 'queued' : 'ok', remaining.length ? ('In coda: ' + remaining.length) : 'Sincronizzato');
  return remaining.length === 0;
}

async function hydrateUserData() {
  if (!state.user || !state.user.id) return;
  if (!AUTH_TOKEN) {
    setSyncStatus('idle', navigator.onLine ? 'Locale' : 'Offline');
    return;
  }
  setSyncStatus('syncing', 'Sincronizzo...');
  try { await syncPendingOps(); } catch(e) {}
  try { await syncLogsFromServer(state.user.id); } catch(e) {}
  try { await syncWorkoutsFromServer(state.user.id); } catch(e) {}
  setSyncStatus('ok', 'Sincronizzato');
}
