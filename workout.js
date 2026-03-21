// WORKOUT
function getScheda(id) { return state.user.schede.find(function(s) { return s.id === (id || state.user.actS); }); }

function saveUser() {
  state.user = normalizeUser(state.user);
  upsertLocalUser(state.user);
  if (AUTH_TOKEN) {
    dbCall('db', {
      table: 'profiles', method: 'update',
      filter: {id: state.user.id},
      values: {nm:state.user.nm, cg:state.user.cg, ps:state.user.ps, al:state.user.al, at:state.user.at, ob:state.user.ob, lav:state.user.lav, po:state.user.po, fab:state.user.fab, schede:state.user.schede, act_s:state.user.actS}
    });
  }
}

function popScanDest() {
  if (!state.user) return;
  var sel = document.getElementById('scan-dest');
  if (!sel) return;
  sel.innerHTML = state.user.schede.map(function(s) { return '<option value="' + s.id + '">' + s.nm + '</option>'; }).join('');
}

function renderWorkout() {
  var h = '';
  state.user.schede.forEach(function(s) {
    h += '<button class="stab' + (s.id === state.user.actS ? ' on' : '') + '" data-action="switch-scheda" data-scheda-id="' + s.id + '">' + s.nm + '</button>';
  });
  document.getElementById('sbar').innerHTML = h;
  renderEx();
  popScanDest();
}

function switchS(id) { state.user.actS = id; saveUser(); renderWorkout(); }

function renderEx() {
  var sc = getScheda(), h = '';
  if (!sc) { document.getElementById('exlist').innerHTML = ''; return; }
  sc.ex.forEach(function(ex) {
    var tot = ex.serie.length;
    var dn = ex.serie.filter(function(s) { return s.done; }).length;
    var isTempo = ex.tipo === 'tempo';
    var tipoLabel = isTempo
      ? '<span class="ex-tipo t">&#9201; TEMPO</span>'
      : '<span class="ex-tipo r">&#128170; REPS</span>';
    h += '<div class="exc"><div class="exh" data-action="toggle-exercise" data-exercise-id="' + ex.id + '"><div><div class="exn">' + ex.nm + tipoLabel + '</div><div class="exm">' + dn + '/' + tot + ' serie' + (ex.note ? ' - ' + ex.note : '') + '</div><div class="pb" style="margin-top:5px"><div class="pf" style="width:' + (tot ? dn/tot*100 : 0) + '%"></div></div></div><div style="display:flex;align-items:center;gap:5px"><button class="dex" data-action="delete-exercise" data-exercise-id="' + ex.id + '">x</button><svg class="chev' + (state.workout.openExercises[ex.id] ? ' op' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg></div></div>';
    h += '<div class="exb' + (state.workout.openExercises[ex.id] ? ' op' : '') + '">';
    if (isTempo) {
      h += '<div class="shdr tempo"><span>#</span><span>DURATA</span><span>ok</span></div>';
      ex.serie.forEach(function(s, si) {
        h += '<div class="srow tempo"><div class="sn">' + (si+1) + '</div><input class="si" placeholder="es. 4 min" value="' + s.rp + '" data-change-action="update-series-field" data-exercise-id="' + ex.id + '" data-series-index="' + si + '" data-field="rp" style="text-align:left;padding:7px 8px"><button class="dbt' + (s.done ? ' ck' : '') + '" data-action="toggle-series-done" data-exercise-id="' + ex.id + '" data-series-index="' + si + '"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button></div>';
      });
    } else {
      h += '<div class="shdr reps"><span>#</span><span>KG</span><span>REPS</span><span>ok</span></div>';
      ex.serie.forEach(function(s, si) {
        h += '<div class="srow reps"><div class="sn">' + (si+1) + '</div><input class="si" type="number" inputmode="decimal" placeholder="kg" value="' + s.kg + '" data-change-action="update-series-field" data-exercise-id="' + ex.id + '" data-series-index="' + si + '" data-field="kg"><input class="si" type="number" inputmode="numeric" placeholder="reps" value="' + s.rp + '" data-change-action="update-series-field" data-exercise-id="' + ex.id + '" data-series-index="' + si + '" data-field="rp"><button class="dbt' + (s.done ? ' ck' : '') + '" data-action="toggle-series-done" data-exercise-id="' + ex.id + '" data-series-index="' + si + '"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button></div>';
      });
    }
    h += '<button class="aser" data-action="add-series" data-exercise-id="' + ex.id + '">+ Aggiungi serie</button></div></div>';
  });
  document.getElementById('exlist').innerHTML = h;
}

function togEx(id) { state.workout.openExercises[id] = !state.workout.openExercises[id]; renderEx(); }
function upS(eid, si, f, v) {
  var sc = getScheda(), ex = sc.ex.find(function(e) { return e.id === eid; });
  if (ex) { ex.serie[si][f] = v; saveUser(); }
}
function togDone(eid, si) {
  var sc = getScheda(), ex = sc.ex.find(function(e) { return e.id === eid; });
  if (ex) { ex.serie[si].done = !ex.serie[si].done; saveUser(); renderEx(); }
}
function addSerie(eid) {
  var sc = getScheda(), ex = sc.ex.find(function(e) { return e.id === eid; });
  if (ex) {
    var isTempo = ex.tipo === 'tempo';
    ex.serie.push(isTempo ? {kg:'', rp:'', done:false} : {kg:'', rp:'', done:false});
    saveUser(); renderEx();
  }
}
function addEx() {
  var n = document.getElementById('nex').value.trim();
  if (!n) return;
  var tipoEl = document.getElementById('nex-tipo');
  var tipo = tipoEl ? tipoEl.value : 'reps';
  var sc = getScheda();
  sc.ex.push({id:uid(), nm:n, note:'', tipo:tipo, serie:[{kg:'',rp:'',done:false},{kg:'',rp:'',done:false},{kg:'',rp:'',done:false}]});
  document.getElementById('nex').value = '';
  saveUser(); renderEx();
}
function delEx(id) {
  var sc = getScheda();
  sc.ex = sc.ex.filter(function(e) { return e.id !== id; });
  delete state.workout.openExercises[id];
  saveUser(); renderEx();
}

async function salvaWorkout() {
  var sc = getScheda();
  var fatti = sc.ex.filter(function(e) {
    return e.serie.some(function(s) { return s.done && s.rp; });
  });
  if (!fatti.length) { alert('Completa almeno una serie prima di salvare.'); return; }
  var kcalBru = stimaKcal(fatti);
  try {
    var riepilogo = fatti.map(function(e) {
      var sf = e.serie.filter(function(s) { return s.done && s.rp; });
      return e.nm + ': ' + sf.map(function(s) { return s.rp + (s.kg ? 'x' + s.kg + 'kg' : ''); }).join(', ');
    }).join(' | ');
    if (riepilogo) {
      var d = await callAI('', {model:'claude-sonnet-4-20250514', max_tokens:20, messages:[{role:'user', content:'Stima calorie bruciate totali (peso atleta: ' + state.user.ps + 'kg). Rispondi SOLO numero intero: ' + riepilogo}]});
      if (!d.error) {
        var txt = d.content && d.content[0] && d.content[0].text || '0';
        var v = parseInt(txt.replace(/[^0-9]/g, '')) || 0;
        if (v > 0) kcalBru = v;
      }
    }
  } catch(e) {}
  addWorkout({
    id:uid(), uid:state.user.id, dt:new Date().toISOString(),
    sc:sc.nm, sid:sc.id, dur:state.workout.timer.seconds, kcal:kcalBru,
    ex: fatti.map(function(e) {
      return {nm:e.nm, serie:e.serie.filter(function(s){return s.done;}).map(function(s){return {kg:s.kg||0, rp:s.rp||0};})};
    })
  });
  var today = dkey(new Date()), log = getLog(state.user.id, today);
  log.kcalBruciate = (log.kcalBruciate || 0) + kcalBru;
  saveLog(state.user.id, today, log);
  sc.ex.forEach(function(e) { e.serie.forEach(function(s) { s.done = false; }); });
  saveUser();
  resetTimer();
  renderEx();
  renderHome();
  alert('Sessione salvata! Calorie bruciate: ~' + kcalBru + ' kcal');
}

function stimaKcal(fatti) {
  var tot = 0;
  fatti.forEach(function(e) {
    var isTempo = e.tipo === 'tempo';
    if (isTempo) {
      e.serie.forEach(function(s) {
        if (s.done && s.rp) {
          var min = tempoToMinutes(s.rp);
          tot += min * 5;
        }
      });
    } else {
      e.serie.forEach(function(s) {
        if (s.done && s.kg) tot += parseFloat(s.kg) * parseInt(s.rp||1) * 0.15;
      });
    }
  });
  return Math.round(Math.max(tot, 80));
}

// SCAN SCHEDA AI - 2 passaggi
async function handleScan(e) {
  var files = e.target.files;
  if (!files || !files.length) return;
  var file = files[0];
  document.getElementById('fn').textContent = 'File: ' + file.name;
  var key = state.user.apiKey || '';
  document.getElementById('scan-ld').style.display = 'block';
  document.getElementById('scan-res').className = 'asr';
  try {
    var b64 = await new Promise(function(res, rej) {
      var r = new FileReader();
      r.onload = function() { var x = r.result, c = x.indexOf(','); res(c >= 0 ? x.slice(c+1) : x); };
      r.onerror = function() { rej(new Error('Lettura fallita')); };
      r.readAsDataURL(file);
    });
    var fname = file.name.toLowerCase();
    var isPDF = file.type === 'application/pdf' || fname.endsWith('.pdf');
    var mt = isPDF ? 'application/pdf' : (file.type || 'image/jpeg');

    // PASSAGGIO 1: trascrivi la scheda
    var p1 = 'Trascrivi questa scheda di allenamento. Per ogni esercizio scrivi su una riga: NOME | SERIE | DURATA con unita (min/sec/reps) | INTENSITA (kg/RPE/BW) | NOTE. Mantieni le unita originali.';
    var mc1 = isPDF
      ? [{type:'document', source:{type:'base64', media_type:'application/pdf', data:b64}}, {type:'text', text:p1}]
      : [{type:'image', source:{type:'base64', media_type:mt, data:b64}}, {type:'text', text:p1}];

    document.getElementById('fn').textContent = 'Leggo la scheda...';
    var d1 = await callAI(key, {model:'claude-sonnet-4-20250514', max_tokens:3000, messages:[{role:'user', content:mc1}]});
    if (d1.error) throw new Error(d1.error.message);
    var testo = d1.content && d1.content[0] && d1.content[0].text || '';

    // PASSAGGIO 2: JSON strutturato
    var p2 = 'Dati esercizi: ' + testo + ' --- Converti in JSON. Regole: 1) durata in min o sec = tipo tempo, metti in campo tempo. 2) durata in reps o numero = tipo reps, metti in campo reps. 3) RPE = non e kg. 4) BW = peso corporeo. Traduzioni: Treadmill=Tapis Roulant, Upright bike=Cyclette, Arm ergometer=Ergometro braccia, Lat Pulldown=Lat Machine, Chest Press=Panca piana. Rispondi SOLO con questo JSON senza nient altro: {"esercizi":[{"nome":"Cyclette","serie":1,"reps":"","kg":"","tempo":"4 min","note":"RPE 3","tipo":"tempo"},{"nome":"Squat","serie":4,"reps":"20-40","kg":"BW","tempo":"","note":"","tipo":"reps"}]}';

    document.getElementById('fn').textContent = 'Struttura esercizi...';
    var d2 = await callAI(key, {model:'claude-sonnet-4-20250514', max_tokens:2000, messages:[{role:'user', content:p2}]});
    if (d2.error) throw new Error(d2.error.message);
    var txt = d2.content && d2.content[0] && d2.content[0].text || '';
    var clean = txt.replace(/```json/g, '').replace(/```/g, '').trim();
    var js = clean.indexOf('{'), je = clean.lastIndexOf('}');
    if (js >= 0 && je > js) clean = clean.slice(js, je+1);
    var parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(pe) {
      var jStart = clean.indexOf('{');
      var jEnd = clean.lastIndexOf('}');
      if (jStart >= 0 && jEnd > jStart) {
        parsed = JSON.parse(clean.slice(jStart, jEnd+1));
      } else {
        throw new Error('JSON non valido dalla scansione');
      }
    }
    state.workout.scanExercises = parsed.esercizi || [];
    if (!state.workout.scanExercises.length) throw new Error('Nessun esercizio trovato');

    document.getElementById('fn').textContent = state.workout.scanExercises.length + ' esercizi trovati';
    var schedaOpts = '<option value="ALL">Tutte le schede</option>' + state.user.schede.map(function(s) { return '<option value="' + s.id + '">' + s.nm + '</option>'; }).join('');
    var h = '<div style="font-size:11px;color:var(--mu);margin-bottom:8px">Scegli la scheda per ogni esercizio</div>';
    state.workout.scanExercises.forEach(function(ex, i) {
      var isT = ex.tipo === 'tempo' || (ex.tempo && ex.tempo !== '');
      var det = isT
        ? (ex.serie||1) + ' x ' + ex.tempo + (ex.note ? ' - ' + ex.note : '')
        : (ex.serie||3) + ' serie x ' + (ex.reps||'10') + (ex.kg && ex.kg !== '' && ex.kg !== '0' ? ' - ' + ex.kg + 'kg' : '') + (ex.note ? ' - ' + ex.note : '');
      h += '<div class="asex" style="flex-wrap:wrap;gap:6px">';
      h += '<input type="checkbox" style="accent-color:var(--acc);width:15px;height:15px;margin-top:3px;flex-shrink:0" id="sc' + i + '" checked>';
      h += '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px"><label for="sc' + i + '">' + ex.nome + '</label>';
      h += '<span style="font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;margin-left:5px;background:' + (isT ? 'rgba(62,207,142,.15);color:var(--g)' : 'rgba(200,241,53,.15);color:var(--acc)') + '">' + (isT ? '&#9201; TEMPO' : '&#128170; REPS') + '</span></div>';
      h += '<div style="font-size:11px;color:var(--mu);margin-top:2px">' + det + '</div></div>';
      h += '<select id="sd' + i + '" style="font-size:11px;padding:4px 6px;border-radius:7px;border:1px solid var(--bd);background:var(--s2);color:#f2f2f2;flex-shrink:0">' + schedaOpts + '</select>';
      h += '</div>';
    });
    document.getElementById('scan-items').innerHTML = h;
    document.getElementById('scan-res').className = 'asr on';
  } catch(err) {
    document.getElementById('fn').textContent = 'Errore: ' + err.message;
    alert('Errore scansione: ' + err.message);
  } finally {
    document.getElementById('scan-ld').style.display = 'none';
    // Reset input file per permettere ricaricamento stesso file
    var fi = document.getElementById('finput');
    if (fi) fi.value = '';
  }
}

function aggiungiScansionati() {
  var n = 0;
  var riepilogo = {};
  state.workout.scanExercises.forEach(function(ex, i) {
    var cb = document.getElementById('sc' + i);
    if (!cb || !cb.checked) return;
    var sdEl = document.getElementById('sd' + i);
    var sid = sdEl ? sdEl.value : (state.user.schede[0] ? state.user.schede[0].id : 'A');
    var isT = ex.tipo === 'tempo' || (ex.tempo && ex.tempo !== '');
    var ns = parseInt(ex.serie) || (isT ? 1 : 3);
    var targets = sid === 'ALL' ? state.user.schede : [getScheda(sid)];
    targets.forEach(function(sc) {
      if (!sc) return;
      var serie = [];
      for (var j = 0; j < ns; j++) {
        serie.push(isT
          ? {kg:'', rp: ex.tempo || '', done:false}
          : {kg: ex.kg && ex.kg !== '0' ? ex.kg : '', rp: ex.reps || '10', done:false}
        );
      }
      sc.ex.push({id:uid(), nm:ex.nome, note:ex.note||'', tipo: isT ? 'tempo' : 'reps', serie:serie});
      riepilogo[sc.nm] = (riepilogo[sc.nm] || 0) + 1;
    });
    n++;
  });
  saveUser();
  document.getElementById('scan-res').className = 'asr';
  renderWorkout();
  var msg = n + ' esercizi aggiunti: ';
  msg += Object.keys(riepilogo).map(function(k) { return riepilogo[k] + ' in ' + k; }).join(', ');
  alert(msg + '!');
}
