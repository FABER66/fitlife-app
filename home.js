// HOME
function renderHome() {
  document.getElementById('greet-nm').textContent = state.user.nm;
  var log = getLog(state.user.id, state.currentDate), tot = getTot(log), tg = state.user.fab.kc;
  document.getElementById('h-kc').textContent = tot.k;
  document.getElementById('h-kt').textContent = '/ ' + tg + ' kcal';
  var bar = document.getElementById('h-kb');
  bar.style.width = Math.min(tot.k / tg * 100, 100) + '%';
  bar.className = 'pf' + (tot.k > tg ? ' ov' : '');
  document.getElementById('h-pr').textContent = tot.p + 'g';
  document.getElementById('h-cb').textContent = tot.c + 'g';
  document.getElementById('h-gr').textContent = tot.g + 'g';
  var ws = getWorkouts(state.user.id);
  if (ws.length) {
    document.getElementById('h-wk').textContent = ws[0].sc;
    document.getElementById('h-ws').textContent = fmtD(ws[0].dt.split('T')[0]);
  } else {
    document.getElementById('h-wk').textContent = '-';
    document.getElementById('h-ws').textContent = 'Nessuno ancora';
  }
}
