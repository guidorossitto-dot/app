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
  if (App.state.runtime.bindings.loginUI) return;
  App.state.runtime.bindings.loginUI = true;

  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!loginBtn || !logoutBtn) return;

  loginBtn.addEventListener("click", async () => {
    const result = await App.actions?.login?.();

    if (!result?.ok) {
      if (result?.error !== "MISSING_EMAIL" && result?.error !== "MISSING_PASSWORD") {
        alert("No se pudo iniciar sesión.");
      }
      return;
    }

    if (App.state.runtime.map) {
      App.state.runtime.map.closePopup();
    }

    App.commit?.({
      persist: false,
      purgePast: false,
      rebuildMarkers: true,
      recomputeNearby: true
    });
  });

  logoutBtn.addEventListener("click", async () => {
    const result = await App.actions?.logout?.();

    if (!result?.ok) {
      alert("No se pudo cerrar sesión.");
      return;
    }

    if (App.state.runtime.map) {
      App.state.runtime.map.closePopup();
    }

    App.map?.clearEventCreationMarker?.();

    App.commit?.({
      persist: false,
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

  // commit()
// No persiste datos.
// Solo re-renderiza la UI con defaults consistentes.
// La persistencia ocurre en storage / services (addEventRemote, updateEvent, etc).

  function commit(opts = {}) {
    const finalOpts = {
      persist: false,
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