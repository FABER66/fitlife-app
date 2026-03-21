// APP INIT + EVENTI
function bindActionEvents() {
  document.addEventListener('click', function(event) {
    var el = event.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    switch (action) {
      case 'show-tab': mostraTab(el.getAttribute('data-tab')); break;
      case 'login': doAccedi(); break;
      case 'register': doRegistra(); break;
      case 'show-page': mostraPg(el.getAttribute('data-page')); break;
      case 'change-day': chgD(parseInt(el.getAttribute('data-delta'), 10) || 0); break;
      case 'open-food-modal': aprMod(); break;
      case 'open-file-picker': document.getElementById('finput').click(); break;
      case 'add-scanned': aggiungiScansionati(); break;
      case 'add-exercise': addEx(); break;
      case 'save-workout': salvaWorkout(); break;
      case 'save-weight': salvaPeso(); break;
      case 'calculate-forecast': calcolaPrevisione(); break;
      case 'toggle-timer': togTimer(); break;
      case 'analyze-food': callFoodAI(); break;
      case 'add-selected-food': addFoodItems(); break;
      case 'add-manual-food': addManuale(); break;
      case 'close-food-modal': chiudiMod(); break;
      case 'quick-login': quickLogin(el.getAttribute('data-user-id')); break;
      case 'delete-food': delAlim(el.getAttribute('data-pasto'), parseInt(el.getAttribute('data-index'), 10)); break;
      case 'switch-scheda': switchS(el.getAttribute('data-scheda-id')); break;
      case 'toggle-exercise':
        if (event.target.closest('[data-action="delete-exercise"]')) return;
        togEx(el.getAttribute('data-exercise-id'));
        break;
      case 'delete-exercise':
        event.stopPropagation();
        delEx(el.getAttribute('data-exercise-id'));
        break;
      case 'toggle-series-done':
        togDone(el.getAttribute('data-exercise-id'), parseInt(el.getAttribute('data-series-index'), 10));
        break;
      case 'add-series':
        addSerie(el.getAttribute('data-exercise-id'));
        break;
      case 'update-profile':
        aggProfilo();
        break;
      case 'logout':
        logout();
        break;
    }
  });

  document.addEventListener('change', function(event) {
    var el = event.target.closest('[data-change-action]');
    if (!el) return;
    if (el.getAttribute('data-change-action') === 'update-series-field') {
      upS(el.getAttribute('data-exercise-id'), parseInt(el.getAttribute('data-series-index'), 10), el.getAttribute('data-field'), event.target.value);
    }
  });
}

function initApp() {
  bindActionEvents();
  ripristinaSessione().then(function(ok) {
    if (!ok) renderQuick();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
