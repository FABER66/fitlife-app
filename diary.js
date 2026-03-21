// DIARIO
function salvaPeso() {
  var val = parseFloat(document.getElementById('peso-inp').value) || 0;
  if (val < 20 || val > 300) { alert('Inserisci un peso valido es. 82.5'); return; }
  var today = dkey(new Date());
  var log = getLog(state.user.id, today);
  log.peso = val;
  saveLog(state.user.id, today, log);
  document.getElementById('peso-inp').value = '';
  renderDiario();
  alert('Peso salvato: ' + val + ' kg');
}

function calcolaPrevisione() {
  var po = parseFloat(document.getElementById('po-inp').value) || 0;
  if (po < 20 || po > 300) { alert('Inserisci un peso obiettivo valido es. 78'); return; }
  var ps = getLatestPeso(state.user.id, 30) || state.user.ps || 70;
  var fab = state.user.fab ? state.user.fab.kc : 2000;
  var kgDiff = po - ps;
  var defTot = 0, gg = 0;
  for (var i = 0; i < 14; i++) {
    var d2 = new Date(); d2.setDate(d2.getDate() - i);
    var dk = dkey(d2);
    var lg = getLog(state.user.id, dk);
    var tt = getTot(lg);
    if (tt.k > 0) { defTot += (fab - (tt.k - (lg.kcalBruciate || 0))); gg++; }
  }
  var defG = gg > 0 ? defTot / gg : (state.user.ob === 'dimagrire' ? 500 : state.user.ob === 'massa' ? -300 : 200);
  if (kgDiff < 0 && defG < 0) defG = Math.abs(defG);
  if (kgDiff > 0 && defG > 0) defG = -Math.abs(defG);
  var minDef = Math.max(Math.abs(defG), 50);
  var giorni = Math.round(Math.abs(kgDiff) * 7700 / minDef);
  var sett = Math.round(giorni / 7);
  var dataFine = new Date(); dataFine.setDate(dataFine.getDate() + giorni);
  var dataStr = dataFine.toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'});
  var pv = document.getElementById('prev-val');
  var ps2 = document.getElementById('prev-sub');
  var pd = document.getElementById('prev-det');
  pv.textContent = sett; pv.style.display = 'block';
  ps2.textContent = 'settimane per raggiungere ' + po + ' kg'; ps2.style.display = 'block';
  pd.innerHTML = 'Da <b>' + ps + 'kg</b> a <b>' + po + 'kg</b> (' + (kgDiff > 0 ? '+' : '') + kgDiff.toFixed(1) + 'kg)<br>Deficit: <b>' + Math.round(Math.abs(defG)) + ' kcal/gg</b> ' + (gg > 0 ? '(' + gg + ' giorni reali)' : '(stima)') + '<br>Data stimata: <b>' + dataStr + '</b>';
  pd.style.display = 'block';
  state.user.po = po;
  saveUser();
}

function renderDiario() {
  var today = dkey(new Date());
  var logOggi = getLog(state.user.id, today);
  var totOggi = getTot(logOggi);
  document.getElementById('k-fab').textContent = state.user.fab.kc;
  document.getElementById('k-ass').textContent = totOggi.k;
  document.getElementById('k-bru').textContent = logOggi.kcalBruciate || 0;
  var bil = (totOggi.k - (logOggi.kcalBruciate||0)) - state.user.fab.kc;
  var bv = document.getElementById('bilancio-val');
  var bd = document.getElementById('bilancio-det');
  bv.textContent = (bil > 0 ? '+' : '') + bil;
  bv.style.color = bil > 100 ? 'var(--o)' : bil < -100 ? 'var(--g)' : 'var(--mu)';
  bd.textContent = bil > 100 ? 'Surplus: stai mangiando piu del fabbisogno' : bil < -100 ? 'Deficit: stai bruciando piu di quanto mangi' : 'In linea con il fabbisogno';
  document.getElementById('peso-info').textContent = logOggi.peso > 0 ? 'Peso registrato oggi: ' + logOggi.peso + ' kg' : 'Inserisci il tuo peso di questa mattina';
  if (state.user.po > 0) {
    var poInp = document.getElementById('po-inp');
    if (poInp && !poInp.value) poInp.value = state.user.po;
  }
  var h = '', trovati = 0;
  var allWorkouts = getWorkouts(state.user.id);
  for (var i = 0; i < 30; i++) {
    var dt = new Date(); dt.setDate(dt.getDate() - i);
    var dk2 = dkey(dt);
    var log = getLog(state.user.id, dk2);
    var tot = getTot(log);
    var bru = log.kcalBruciate || 0;
    if (!tot.k && !log.peso && !bru) continue;
    trovati++;
    var net = tot.k - bru;
    var bil2 = net - state.user.fab.kc;
    var bc = bil2 > 100 ? 'var(--o)' : bil2 < -100 ? 'var(--g)' : 'var(--mu)';
    h += '<div class="dd"><div class="ddh"><div class="dddate">' + fmtD(dk2) + '</div>' + (log.peso ? '<div class="ddpeso">' + log.peso + ' kg</div>' : '') + '</div>';
    if (tot.k > 0) {
      h += '<div class="ddst">Pasti</div>';
      ['Colazione','Pranzo','Cena','Spuntino'].forEach(function(p) {
        var al = log.pasti[p] || [];
        if (!al.length) return;
        var pk = al.reduce(function(a,x) { return a + x.kc; }, 0);
        h += '<div class="ddi"><span>' + p + ' (' + al.length + ')</span><span class="ddn">' + Math.round(pk) + ' kcal</span></div>';
      });
    }
    var wks = allWorkouts.filter(function(w) { return w.dt.split('T')[0] === dk2; });
    if (wks.length) {
      h += '<div class="ddst" style="margin-top:6px">Allenamento</div>';
      wks.forEach(function(w) { h += '<div class="ddi"><span>' + w.sc + (w.dur ? ' (' + Math.floor(w.dur/60) + 'min)' : '') + '</span><span class="ddn">' + (w.kcal||0) + ' kcal</span></div>'; });
    }
    if (tot.k || bru) {
      h += '<div class="ddb"><div class="dbp" style="background:rgba(200,241,53,.08);color:var(--acc)">Fab<br>' + state.user.fab.kc + '</div><div class="dbp" style="background:rgba(62,207,142,.08);color:var(--g)">Ass<br>' + tot.k + '</div><div class="dbp" style="background:rgba(255,107,53,.08);color:var(--o)">Bru<br>' + bru + '</div><div class="dbp" style="background:rgba(150,150,255,.08);color:' + bc + '">Bil<br>' + (bil2>0?'+':'') + bil2 + '</div></div>';
    }
    h += '</div>';
  }
  if (!trovati) h = '<div style="text-align:center;padding:40px 20px;color:var(--mu)"><div style="font-size:40px;margin-bottom:10px">&#128203;</div><p style="font-size:14px">Nessun dato ancora.</p></div>';
  document.getElementById('diario-list').innerHTML = h;
}
