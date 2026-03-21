// LOG PASTI
function getLog(uid, date) {
  var db = loadDB();
  return normalizeLog(db.logs[uid + '_' + date]);
}
function saveLog(uid, date, log) {
  var normalized = normalizeLog(log);
  var db = loadDB();
  if (!db.logs) db.logs = {};
  db.logs[uid + '_' + date] = normalized;
  saveDB(db);
  if (AUTH_TOKEN) {
    dbCall('db', {
      table: 'logs', method: 'upsert',
      values: {user_id: uid, data: date, pasti: normalized.pasti, kcal_bruciate: normalized.kcalBruciate || 0, peso: normalized.peso || 0}
    });
  }
}
function getTot(log) {
  var k=0, p=0, c=0, g=0;
  Object.values(log.pasti).forEach(function(al) {
    al.forEach(function(a) { k += a.kc||0; p += a.pr||0; c += a.cb||0; g += a.gs||0; });
  });
  return {k: Math.round(k), p: Math.round(p), c: Math.round(c), g: Math.round(g)};
}

// NUTRIZIONE
function chgD(d) {
  var dt = new Date(state.currentDate + 'T12:00:00');
  dt.setDate(dt.getDate() + d);
  if (dt > new Date()) return;
  state.currentDate = dkey(dt);
  renderNutri();
}

function renderNutri() {
  document.getElementById('dlbl').textContent = fmtD(state.currentDate);
  var log = getLog(state.user.id, state.currentDate), tot = getTot(log), tg = state.user.fab.kc;
  var c = 2 * Math.PI * 54, off = c - Math.min(tot.k / tg, 1) * c;
  var ring = document.getElementById('ring');
  ring.style.strokeDasharray = c;
  ring.style.strokeDashoffset = off;
  ring.className = 'rfill' + (tot.k > tg ? ' ov' : '');
  document.getElementById('r-kc').textContent = tot.k;
  document.getElementById('r-tg').textContent = tg;
  document.getElementById('m-p').textContent = tot.p + 'g';
  document.getElementById('m-c').textContent = tot.c + 'g';
  document.getElementById('m-g').textContent = tot.g + 'g';
  var ord = ['Colazione','Pranzo','Cena','Spuntino'], h = '';
  ord.forEach(function(p) {
    var al = log.pasti[p] || [], pk = al.reduce(function(a,x) { return a + x.kc; }, 0);
    h += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><div style="font-family:Syne,sans-serif;font-size:13px;font-weight:700">' + p + '</div><div style="font-size:12px;color:var(--mu)">' + Math.round(pk) + ' kcal</div></div>';
    al.forEach(function(a, i) {
      h += '<div style="display:flex;align-items:center;gap:7px;padding:7px 9px;background:var(--s2);border-radius:9px;margin-bottom:4px"><div style="flex:1"><div style="font-size:13px;font-weight:600">' + a.nm + '</div><div style="font-size:11px;color:var(--mu)">' + (a.gr ? a.gr+'g  ' : '') + ' P:' + (a.pr||0) + 'g C:' + (a.cb||0) + 'g G:' + (a.gs||0) + 'g</div></div><div style="font-family:Syne,sans-serif;font-size:13px;font-weight:800;color:var(--acc)">' + a.kc + '</div><button style="background:none;border:none;color:var(--mu);cursor:pointer;font-size:16px;padding:0 3px" data-action="delete-food" data-pasto="' + p + '" data-index="' + i + '">x</button></div>';
    });
    if (!al.length) h += '<div style="font-size:12px;color:var(--mu);padding:4px 0">Nessun alimento</div>';
    h += '</div>';
  });
  document.getElementById('pasti').innerHTML = h;
}

function delAlim(p, i) {
  var log = getLog(state.user.id, state.currentDate);
  log.pasti[p].splice(i, 1);
  saveLog(state.user.id, state.currentDate, log);
  renderNutri();
}

function aprMod() {
  document.getElementById('mod-nutri').className = 'mov on';
  document.getElementById('food-res').className = 'ares';
  document.getElementById('food-ld').style.display = 'none';
  document.getElementById('ai-inp').value = '';
  state.food.aiItems = [];
}

function chiudiMod() {
  document.querySelectorAll('.mov').forEach(function(m) { m.className = 'mov'; });
}

async function callFoodAI() {
  var inp = document.getElementById('ai-inp').value.trim();
  if (!inp) return;
  var key = state.user.apiKey || '';
  document.getElementById('food-ld').style.display = 'block';
  document.getElementById('food-res').className = 'ares';
  try {
    var d = await callAI(key, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{role:'user', content: 'Analizza questi alimenti. Rispondi SOLO con JSON valido senza backtick: {"alimenti":[{"nome":"Pasta","gr":150,"kc":320,"pr":10,"cb":60,"gs":5}]} Alimenti: "' + inp + '". Valori per quantita totale.'}]
    });
    if (d.error) throw new Error(d.error.message);
    var txt = d.content && d.content[0] && d.content[0].text || '';
    var parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
    state.food.aiItems = parsed.alimenti || [];
    var h = '';
    state.food.aiItems.forEach(function(a, i) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)"><div style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fc' + i + '" checked style="accent-color:var(--acc);width:15px;height:15px"><label for="fc' + i + '"> ' + a.nome + (a.gr ? ' (' + a.gr + 'g)' : '') + '</label></div><div style="font-family:Syne,sans-serif;font-size:13px;font-weight:800;color:var(--acc)">' + a.kc + ' kcal</div></div>';
    });
    document.getElementById('food-items').innerHTML = h;
    document.getElementById('food-res').className = 'ares on';
  } catch(e) {
    alert('Errore AI: ' + e.message);
  } finally {
    document.getElementById('food-ld').style.display = 'none';
  }
}

function addFoodItems() {
  var p = document.getElementById('mn-pasto').value;
  var log = getLog(state.user.id, state.currentDate);
  state.food.aiItems.forEach(function(a, i) {
    var cb = document.getElementById('fc' + i);
    if (cb && cb.checked) log.pasti[p].push({nm:a.nome, kc:a.kc, gr:a.gr||0, pr:a.pr||0, cb:a.cb||0, gs:a.gs||0});
  });
  saveLog(state.user.id, state.currentDate, log);
  chiudiMod();
  renderNutri();
  renderHome();
}

function addManuale() {
  var nm = document.getElementById('mn-nm').value.trim();
  var kc = parseFloat(document.getElementById('mn-kc').value) || 0;
  if (!nm || !kc) { alert('Inserisci nome e calorie.'); return; }
  var p = document.getElementById('mn-pasto').value;
  var log = getLog(state.user.id, state.currentDate);
  log.pasti[p].push({
    nm: nm, kc: kc,
    gr: parseFloat(document.getElementById('mn-gr').value) || 0,
    pr: parseFloat(document.getElementById('mn-pr').value) || 0,
    cb: parseFloat(document.getElementById('mn-cb').value) || 0,
    gs: parseFloat(document.getElementById('mn-gs').value) || 0
  });
  saveLog(state.user.id, state.currentDate, log);
  chiudiMod();
  renderNutri();
  renderHome();
}
