// ui-render.js
(() => {
  "use strict";

  const App = window.App = window.App || {};
  App.ui = App.ui || {};

  function renderLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    if (!loginBtn || !logoutBtn) return;

    const isAdmin = App.util.isAdminMode();
    const isLoggedIn = !!App.state.logic.isLoggedIn;

if (!isAdmin) {
  loginBtn.hidden = true;
  logoutBtn.hidden = true;
  return;
}
 

      const canManage = App.util.canManageUI();

      loginBtn.hidden = !isAdmin || isLoggedIn;
      logoutBtn.hidden = !canManage;
  }

  function bindLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!loginBtn || !logoutBtn) return;

    loginBtn.addEventListener("click", () => {
      App.actions?.login?.();
      App.commit?.({
        persist: true,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });
    });

    logoutBtn.addEventListener("click", () => {
      App.actions?.logout?.();
      App.commit?.({
        persist: true,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });
    });

    renderLoginUI();
  }

  function renderAll(opts = {}) {
    const finalOpts = {
      persist: false,
      purgePast: false,
      rebuildMarkers: false,
      recomputeNearby: false,
      ...opts
    };

    if (finalOpts.recomputeNearby) {
      const center = App.state.logic.nearbyCenter;
      if (center) {
       App.map.recomputeNearbyEvents(center.lat, center.lng);
    }
    }

    
    App.ui.renderAppShell();
    App.ui.renderLoginUI();
    App.ui.renderList();
    App.ui.renderCalendar();

    App.map.renderMap({
  rebuildMarkers: finalOpts.rebuildMarkers
});
  }

  function commit(opts = {}) {
    const finalOpts = {
      persist: true,
      purgePast: false,
      rebuildMarkers: true,
      recomputeNearby: true,
      ...opts
    };

    return renderAll(finalOpts);
  }

  App.ui.renderLoginUI = renderLoginUI;
  App.ui.bindLoginUI = bindLoginUI;

  App.renderAll = renderAll;
  App.commit = commit;
})();