// NAVIGAZIONE
function mostraPg(p) {
  document.querySelectorAll('.pg').forEach(function(x) { x.className = 'pg'; });
  document.querySelectorAll('.nb').forEach(function(x) { x.className = 'nb'; });
  var pg = document.getElementById('pg-' + p);
  if (pg) pg.className = 'pg on';
  var nbs = document.querySelectorAll('.nb');
  var mp = {home:0, nutri:1, workout:2, diario:3, profilo:4};
  if (mp[p] !== undefined && nbs[mp[p]]) nbs[mp[p]].className = 'nb on';
  if (p === 'home') renderHome();
  if (p === 'nutri') renderNutri();
  if (p === 'workout') renderWorkout();
  if (p === 'diario') renderDiario();
  if (p === 'profilo') renderProfilo();
}
