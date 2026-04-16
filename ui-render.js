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

function renderDiscovery() {
  const root = document.getElementById("discoveryResult");
  if (!root) return;

  root.innerHTML = "";

  const eventId = App.state.logic.discovery?.resultEventId;
  if (!eventId) {
    root.innerHTML = `
      <div class="nearbySmall">
        Probá una sugerencia y te mostramos una salida posible.
      </div>
    `;
    return;
  }

  const ev = App.events?.findEventById?.(eventId);
  if (!ev) {
    root.innerHTML = `
      <div class="nearbySmall">
        No encontramos esa sugerencia.
      </div>
    `;
    return;
  }

  const reason = App.selectors?.buildDiscoveryReason?.(ev) || "Plan recomendado";
  const place = App.util?.shortPlaceName?.(ev.placeName) || "Lugar a confirmar";
  const status = App.util?.getEventStatus?.(ev) || "";
  const cat = App.util?.categoryLabel?.(ev.category) || "";
  const icon = App.util?.categoryEmoji?.(ev.category) || "📍";
  const time = (ev.startTime || "").slice(0, 5);

  root.innerHTML = `
    <div class="eventMiniCard eventMiniCard--${ev.category || "music"}">
      <div class="eventMiniCard__top">
        <div class="eventMiniCard__icon eventMiniCard__icon--${ev.category || "music"}">
          ${icon}
        </div>

        <div class="eventMiniCard__main">
          <div class="eventMiniCard__titleRow">
            <span class="eventMiniCard__time">${time}</span>
            <span class="eventMiniCard__title">${ev.title || "Evento"}</span>
          </div>

          <div class="eventMiniCard__status">${reason}</div>
          <div class="eventMiniCard__meta">
            ${place}${cat ? ` · ${cat}` : ""}${status ? ` · ${status}` : ""}
          </div>

          <div class="eventMiniCard__actions">
            <button
              class="linkBtn discoveryMapBtn"
              data-eid="${encodeURIComponent(ev.id)}"
              data-lat="${Number(ev.lat)}"
              data-lng="${Number(ev.lng)}">
              Ver en mapa
            </button>

            <button
              class="linkBtn discoveryFavBtn"
              data-eid="${encodeURIComponent(ev.id)}">
              ${App.events?.isFavorite?.(ev.id) ? "❤️ Guardado" : "🤍 Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
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
    App.ui.renderDiscovery?.();
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
  App.ui.renderDiscovery = renderDiscovery;
  App.ui.bindLoginUI = bindLoginUI;

  App.renderAll = renderAll;
  App.commit = commit;
})();