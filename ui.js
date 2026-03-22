// UI FEEDBACK + SYNC STATUS
function ensureToastRoot() {
  var root = document.getElementById('toast-root');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'toast-root';
  root.className = 'toast-root';
  document.body.appendChild(root);
  return root;
}

function showToast(message, type) {
  var root = ensureToastRoot();
  var t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.textContent = message;
  root.appendChild(t);
  requestAnimationFrame(function() { t.classList.add('show'); });
  setTimeout(function() {
    t.classList.remove('show');
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
  }, 2600);
}

function ensureSyncBadge() {
  var badge = document.getElementById('sync-badge');
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = 'sync-badge';
  badge.className = 'sync-badge';
  badge.textContent = 'Locale';
  document.body.appendChild(badge);
  return badge;
}

function setSyncStatus(status, message) {
  var badge = ensureSyncBadge();
  badge.className = 'sync-badge ' + (status || 'idle');
  badge.textContent = message || 'Locale';
}
