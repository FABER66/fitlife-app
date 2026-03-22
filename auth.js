// AUTH
function mostraTab(t) {
  document.getElementById('t-acc').className = 'atab' + (t === 'acc' ? ' on' : '');
  document.getElementById('t-reg').className = 'atab' + (t === 'reg' ? ' on' : '');
  document.getElementById('f-acc').style.display = t === 'acc' ? 'block' : 'none';
  document.getElementById('f-reg').style.display = t === 'reg' ? 'block' : 'none';
  document.getElementById('aerr').style.display = 'none';
}

function showErr(m) {
  var e = document.getElementById('aerr');
  e.textContent = m;
  e.style.display = 'block';
}

function renderQuick() {
  var db = loadDB(), w = document.getElementById('qlist');
  var users = (db.users || []).map(function(u) { return normalizeUser(u); }).filter(Boolean);
  if (!users.length) { w.innerHTML = ''; return; }
  var h = '<div class="qtit">Accesso rapido</div>';
  users.slice(0, 3).forEach(function(u) {
    h += '<div class="qchip" data-action="quick-login" data-user-id="' + u.id + '"><div class="qav">' + safeInitials(u.nm, u.cg) + '</div><div><div style="font-weight:600;font-size:13px">' + u.nm + ' ' + u.cg + '</div><div style="font-size:11px;color:var(--mu)">' + u.em + '</div></div></div>';
  });
  w.innerHTML = h;
}

function quickLogin(id) {
  var u = getLocalUserById(id);
  if (!u) return;
  document.getElementById('l-em').value = u.em || '';
  document.getElementById('l-pw').focus();
  showErr('Email inserita. Digita la password per continuare.');
}

async function doAccedi() {
  var em = document.getElementById('l-em').value.trim();
  var pw = document.getElementById('l-pw').value;
  if (!em) { showErr('Inserisci email.'); return; }
  if (!pw) { showErr('Inserisci password.'); return; }
  showErr('Accedo...');
  setSyncStatus('syncing', 'Accesso...');
  var res = await dbCall('signin', {email: em, password: pw});
  if (res && res.token) {
    AUTH_TOKEN = res.token;
    USER_ID = res.userId;
    saveSession(USER_ID, AUTH_TOKEN);
    var pres = await dbCall('db', {table:'profiles', method:'select', filter:{id: USER_ID}});
    if (pres && pres.result && pres.result.length) {
      state.user = normalizeUser(supabaseToUser(pres.result[0]));
      upsertLocalUser(state.user);
      await hydrateUserData();
      entrApp();
      return;
    }
  }
  AUTH_TOKEN = null;
  var u = await findLocalUserByCredentials(em, pw);
  if (!u) { showErr('Email o password errati.'); return; }
  USER_ID = u.id;
  saveSession(USER_ID, null);
  state.user = u;
  upsertLocalUser(state.user);
  setSyncStatus(navigator.onLine ? 'idle' : 'offline', navigator.onLine ? 'Locale' : 'Offline');
  entrApp();
}

function supabaseToUser(p) {
  return normalizeUser({
    id: p.id, nm: p.nm, cg: p.cg, em: p.em, pw: '',
    et: p.et, sx: p.sx, ps: p.ps, al: p.al, at: p.at,
    ob: p.ob, lav: p.lav, po: p.po, fab: p.fab,
    schede: p.schede || [{id:'A',nm:'Scheda A',ex:[]},{id:'B',nm:'Scheda B',ex:[]}],
    actS: p.act_s || 'A', apiKey: '', cre: p.created_at
  });
}

async function doRegistra() {
  var nm = document.getElementById('r-nm').value.trim();
  var cg = document.getElementById('r-cg').value.trim();
  var em = document.getElementById('r-em').value.trim();
  var pw = document.getElementById('r-pw').value;
  var et = parseInt(document.getElementById('r-et').value) || 0;
  var sx = document.getElementById('r-sx').value;
  var ps = parseFloat(document.getElementById('r-ps').value) || 0;
  var al = parseFloat(document.getElementById('r-al').value) || 0;
  var at = document.getElementById('r-at').value || '1.55';
  var ob = document.getElementById('r-ob').value || 'mantenere';
  var lav = document.getElementById('r-lav').value || 'sedentario';
  var po = parseFloat(document.getElementById('r-po').value) || 0;
  if (!nm) { showErr('Inserisci il nome.'); return; }
  if (!cg) { showErr('Inserisci il cognome.'); return; }
  if (!em || em.indexOf('@') < 1) { showErr('Email non valida.'); return; }
  if (!pw || pw.length < 4) { showErr('Password min 4 caratteri.'); return; }
  if (et < 10 || et > 99) { showErr('Eta non valida.'); return; }
  if (ps < 20 || ps > 300) { showErr('Peso non valido.'); return; }
  if (al < 100 || al > 250) { showErr('Altezza non valida.'); return; }
  var fab = calcFab(sx, ps, al, et, at, ob, lav);
  var schede = [{id:'A',nm:'Scheda A',ex:[]},{id:'B',nm:'Scheda B',ex:[]}];
  showErr('Creo il profilo...');
  var res = await dbCall('signup', {
    email: em, password: pw,
    profile: {nm:nm, cg:cg, et:et, sx:sx, ps:ps, al:al, at:at, ob:ob, lav:lav, po:po, fab:fab, schede:schede, act_s:'A'}
  });
  if (res && res.userId) {
    var loginRes = await dbCall('signin', {email: em, password: pw});
    if (loginRes && loginRes.token) {
      AUTH_TOKEN = loginRes.token;
      USER_ID = loginRes.userId;
      saveSession(USER_ID, AUTH_TOKEN);
    }
    state.user = normalizeUser({id: res.userId, nm:nm, cg:cg, em:em, pw:'', et:et, sx:sx, ps:ps, al:al, at:at, ob:ob, lav:lav, po:po, fab:fab, schede:schede, actS:'A', apiKey:'', cre:new Date().toISOString()});
    upsertLocalUser(state.user);
    await hydrateUserData();
    entrApp();
    return;
  }
  showErr(res ? 'Errore: ' + JSON.stringify(res) : 'Salvo in locale...');
  var db = loadDB();
  if (db.users.find(function(x) { return x.em === em; })) { showErr('Email gia registrata.'); return; }
  var localUser = normalizeUser({id:uid(), nm:nm, cg:cg, em:em, pw:'', pwHash:await hashPassword(pw), et:et, sx:sx, ps:ps, al:al, at:at, ob:ob, lav:lav, po:po, fab:fab, schede:schede, actS:'A', apiKey:'', cre:new Date().toISOString()});
  db.users.push(localUser);
  saveDB(db);
  AUTH_TOKEN = null;
  USER_ID = localUser.id;
  saveSession(USER_ID, null);
  state.user = localUser;
  setSyncStatus(navigator.onLine ? 'idle' : 'offline', navigator.onLine ? 'Locale' : 'Offline');
  entrApp();
}

function entrApp() {
  if (!state.user) return;
  state.user = normalizeUser(state.user);
  document.getElementById('auth').className = 'scr';
  document.getElementById('app').className = 'scr on';
  document.getElementById('hav').textContent = safeInitials(state.user.nm, state.user.cg);
  document.getElementById('hnm').textContent = state.user.nm;
  state.currentDate = dkey(new Date());
  mostraPg('home');
  popScanDest();
}

// Tenta ripristino sessione al caricamento pagina
async function ripristinaSessione() {
  var token = localStorage.getItem('fl5_token');
  var userId = localStorage.getItem('fl5_uid');
  if (!userId) return false;
  AUTH_TOKEN = token || null;
  USER_ID = userId;
  if (AUTH_TOKEN) {
    try {
      var pres = await dbCall('db', {table:'profiles', method:'select', filter:{id: userId}});
      if (pres && pres.result && pres.result.length) {
        state.user = normalizeUser(supabaseToUser(pres.result[0]));
        upsertLocalUser(state.user);
        await hydrateUserData();
        entrApp();
        return true;
      }
    } catch(e) {}
  }
  var u = getLocalUserById(userId);
  if (u) {
    AUTH_TOKEN = null;
    state.user = u;
    setSyncStatus(navigator.onLine ? 'idle' : 'offline', navigator.onLine ? 'Locale' : 'Offline');
    entrApp();
    return true;
  }
  clearSession();
  return false;
}

function logout() {
  state.user = null;
  AUTH_TOKEN = null;
  USER_ID = null;
  clearSession();
  resetTimer();
  state.currentDate = dkey(new Date());
  document.getElementById('app').className = 'scr';
  document.getElementById('auth').className = 'scr on';
  document.getElementById('l-pw').value = '';
  document.getElementById('aerr').style.display = 'none';
  mostraTab('acc');
  renderQuick();
  setSyncStatus(navigator.onLine ? 'idle' : 'offline', navigator.onLine ? 'Locale' : 'Offline');
}

