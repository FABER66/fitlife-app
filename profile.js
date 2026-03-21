// PROFILO
function renderProfilo() {
  var lavLabel = {sedentario:'Sedentario', piedi:'In piedi', fisico:'Fisico'}[state.user.lav] || 'Sedentario';
  var h = '<div class="card" style="text-align:center"><div class="pavbig">' + safeInitials(state.user.nm, state.user.cg) + '</div><div style="font-family:Syne,sans-serif;font-size:20px;font-weight:800">' + state.user.nm + ' ' + state.user.cg + '</div><div style="font-size:12px;color:var(--mu);margin-top:3px">' + state.user.em + '</div></div>';
  h += '<div class="card"><div class="ctit">Fabbisogno calorico</div><div class="pgrid"><div class="pi"><div class="pv">' + state.user.fab.kc + '</div><div class="pl">kcal/gg</div></div><div class="pi"><div class="pv">' + state.user.fab.bmr + '</div><div class="pl">BMR</div></div><div class="pi"><div class="pv">' + state.user.fab.tef + '</div><div class="pl">TEF cibo</div></div></div><div style="margin-top:8px;font-size:12px;color:var(--mu);line-height:1.7">Tipo lavoro: <b style="color:#f2f2f2">' + lavLabel + '</b> (+' + state.user.fab.bonusLav + ' kcal/gg)<br>TEF (effetto termico cibo): <b style="color:#f2f2f2">~' + state.user.fab.tef + ' kcal/gg</b> bruciate digerendo</div></div>';
  h += '<div class="card"><div class="ctit">AI</div><div style="font-size:12px;color:var(--mu);line-height:1.7">Le funzioni AI usano il proxy server dell app. In questa versione non serve inserire una API key nel profilo.</div></div>';
  h += '<div class="card"><div class="ctit">Aggiorna dati</div><div class="g2"><div><label class="lbl">Peso kg</label><input class="fi" id="ep-ps" type="number" value="' + state.user.ps + '"></div><div><label class="lbl">Altezza cm</label><input class="fi" id="ep-al" type="number" value="' + state.user.al + '"></div></div>';
  h += '<label class="lbl">Tipo di lavoro</label><select class="fi" id="ep-lav">';
  [['sedentario','Sedentario (ufficio)'],['piedi','In piedi (bar, negozio)'],['fisico','Lavoro fisico']].forEach(function(o) { h += '<option value="' + o[0] + '"' + (state.user.lav === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
  h += '</select><label class="lbl">Attivita fisica</label><select class="fi" id="ep-at">';
  [['1.2','Nessuna'],['1.375','Leggera'],['1.55','Moderata'],['1.725','Intensa'],['1.9','Molto intensa']].forEach(function(o) { h += '<option value="' + o[0] + '"' + (String(state.user.at) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
  h += '</select><label class="lbl">Obiettivo</label><select class="fi" id="ep-ob">';
  [['dimagrire','Dimagrire'],['mantenere','Mantenere'],['massa','Massa']].forEach(function(o) { h += '<option value="' + o[0] + '"' + (state.user.ob === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
  h += '</select><button class="bp" data-action="update-profile" style="margin-top:8px">Aggiorna fabbisogno</button></div>';
  h += '<button class="bdgr" data-action="logout">Esci</button>';
  document.getElementById('prof-cnt').innerHTML = h;
}

function salvaKey() {
  alert('In questa versione non serve inserire alcuna API key.');
}

function aggProfilo() {
  state.user.ps = parseFloat(document.getElementById('ep-ps').value) || state.user.ps;
  state.user.al = parseFloat(document.getElementById('ep-al').value) || state.user.al;
  state.user.at = document.getElementById('ep-at').value;
  state.user.ob = document.getElementById('ep-ob').value;
  state.user.lav = document.getElementById('ep-lav').value;
  state.user.fab = calcFab(state.user.sx, state.user.ps, state.user.al, state.user.et, state.user.at, state.user.ob, state.user.lav);
  saveUser();
  alert('Aggiornato! Fabbisogno: ' + state.user.fab.kc + ' kcal/gg');
  renderProfilo();
}
