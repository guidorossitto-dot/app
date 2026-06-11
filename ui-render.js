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

      const placeSearchCard = document.getElementById("placeSearchCard");
      if (placeSearchCard) {
        placeSearchCard.hidden = true;
      }

      return;
    }

      const canManage = App.util.canManageUI();

      loginBtn.hidden = !isAdmin || isLoggedIn;
      logoutBtn.hidden = !canManage;

      const placeSearchCard = document.getElementById("placeSearchCard");
if (placeSearchCard) {
  placeSearchCard.hidden = !canManage;
}
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

function getMapDateHumanLabel(dateStr) {
  const today = App.util.todayStrYYYYMMDD();
  const tomorrow = App.util.addDaysYYYYMMDD(today, 1);
  const afterTomorrow = App.util.addDaysYYYYMMDD(today, 2);

  if (dateStr === today) return "Hoy";
  if (dateStr === tomorrow) return "Mañana";
  if (dateStr === afterTomorrow) return "Pasado mañana";

  return "Fecha elegida";
}

function setSelectedMapDate(dateStr) {
  const safeDate = String(dateStr || "").slice(0, 10);
  if (!safeDate) return;

  App.state.logic.selectedMapDate = safeDate;

  if (App.state.runtime.map) {
    App.state.runtime.map.closePopup();
  }

  App.state.runtime.activePopupWantsPreserve = false;
  App.state.runtime.activePopupLocationKey = null;
  App.state.runtime.activePopupEventId = null;
  App.state.runtime.activePopupLatLng = null;

  App.commit?.({
    persist: false,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });
}

function renderMapDateUI() {
  const root = document.getElementById("mapDateBar");
  if (!root) return;

  const today = App.util.todayStrYYYYMMDD();
  const selectedDate = String(
    App.state.logic.selectedMapDate || today
  ).slice(0, 10);

  const input = document.getElementById("mapDateInput");
  if (input && input.value !== selectedDate) {
    input.value = selectedDate;
  }

  root.querySelectorAll("[data-map-date-offset]").forEach((btn) => {
    const offset = Number(btn.dataset.mapDateOffset || 0);
    const btnDate = App.util.addDaysYYYYMMDD(today, offset);

    btn.classList.toggle("isActive", btnDate === selectedDate);
  });

const humanLabel = getMapDateHumanLabel(selectedDate);

const summaryText = document.getElementById("mapDateSummaryText");
if (summaryText) {
  summaryText.textContent = humanLabel;
}

const label = document.getElementById("mapDateLabel");
if (label) {
  label.textContent = `${humanLabel} · ${App.util.formatDateDisplay(selectedDate)}`;
}
}

function bindMapDateUI() {
  if (App.state.runtime.bindings.mapDateUI) return;
  App.state.runtime.bindings.mapDateUI = true;

  const root = document.getElementById("mapDateBar");
  if (!root) return;

root.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-map-date-offset]");
  if (!btn) return;

  const offset = Number(btn.dataset.mapDateOffset || 0);
  const today = App.util.todayStrYYYYMMDD();
  const nextDate = App.util.addDaysYYYYMMDD(today, offset);

  setSelectedMapDate(nextDate);

  if (root.tagName === "DETAILS") {
    root.open = false;
  }
});

  const input = document.getElementById("mapDateInput");
  if (input) {
input.addEventListener("change", () => {
  setSelectedMapDate(input.value);

  if (root.tagName === "DETAILS") {
    root.open = false;
  }
});
  }

  renderMapDateUI();
}

function renderFestivalHero() {
  const pageShell = document.querySelector("#publicView .pageShell");
  const appLayout = document.querySelector(".appLayout");
  if (!pageShell || !appLayout) return;

  const existing = document.getElementById("festivalHeroCard");
  if (existing) existing.remove();

  const data = App.selectors?.getActiveFestivalHeroData?.();
  if (!data) return;

  const cfg = data.config || {};
  const soonList = Array.isArray(data.soonEvents) ? data.soonEvents.slice(0, 8) : [];
  const todayList = Array.isArray(data.todayEvents) ? data.todayEvents.slice(0, 8) : [];
  const tickerList = soonList.length ? soonList : todayList;

  const card = document.createElement("section");
  card.className = "panelCard festivalHeroCard";
  card.id = "festivalHeroCard";

  card.innerHTML = `
    <div class="festivalHeroTop">
      <div>
        <div class="festivalHeroKicker">Modo festival</div>
        <h2 class="festivalHeroTitle">${cfg.title || "Festival"}</h2>
        <p class="festivalHeroText">${cfg.text || ""}</p>
      </div>

      <div class="festivalHeroStats">
        <span class="festivalStat">${data.todayCount || 0} hoy</span>
        <span class="festivalStat">${data.soonCount || 0} pronto</span>
      </div>
    </div>

    <div class="festivalHeroActions">
      <button
        type="button"
        class="chip festivalChip"
        id="festivalOnlyChip">
        ${cfg.label || "Festival"}
      </button>
    </div>

    <div class="festivalHeroHint">
      Presioná arriba para seguir solo la programación
    </div>

    ${
      tickerList.length
        ? `
          <div class="festivalTicker" id="festivalTicker">
            <div class="festivalTicker__item" id="festivalTickerItem">
              ${(() => {
                const initialIndex =
                  tickerList.length > 0
                    ? (Number(App.state.runtime.festivalTickerIndex || 0) % tickerList.length + tickerList.length) % tickerList.length
                    : 0;

                const ev = tickerList[initialIndex];
                const evTime = (ev?.startTime || "").slice(0, 5);
                const evTitle = ev?.title || "Actividad";
                const evPlace = App.util?.shortPlaceName?.(ev?.placeName) || "";

                return `${evTime ? `${evTime} · ` : ""}${evTitle}${evPlace ? ` · ${evPlace}` : ""}`;
              })()}
            </div>
          </div>
        `
        : ""
    }
  `;

  pageShell.insertBefore(card, appLayout);

  const festivalChip = card.querySelector("#festivalOnlyChip");
  if (festivalChip) {
    festivalChip.classList.toggle("isActive", !!App.state.logic.festivalOnly);

    festivalChip.addEventListener("click", () => {
      App.actions?.toggleFestivalOnly?.();
    });
  }

  const tickerEl = card.querySelector("#festivalTickerItem");

  if (tickerEl && tickerList.length > 0) {
    let tickerIndex = Number(App.state.runtime.festivalTickerIndex || 0);
    if (!Number.isFinite(tickerIndex) || tickerIndex < 0) tickerIndex = 0;
    tickerIndex = tickerIndex % tickerList.length;

    const currentEv = tickerList[tickerIndex];
    if (currentEv) {
      const evTime = (currentEv?.startTime || "").slice(0, 5);
      const evTitle = currentEv?.title || "Actividad";
      const evPlace = App.util?.shortPlaceName?.(currentEv?.placeName) || "";

      tickerEl.textContent = `${evTime ? `${evTime} · ` : ""}${evTitle}${evPlace ? ` · ${evPlace}` : ""}`;
    }

    window.clearInterval(App.state.runtime.festivalTickerInterval);

    if (tickerList.length > 1) {
      App.state.runtime.festivalTickerInterval = window.setInterval(() => {
        tickerEl.classList.add("is-leaving");

        window.setTimeout(() => {
          tickerIndex = (tickerIndex + 1) % tickerList.length;
          App.state.runtime.festivalTickerIndex = tickerIndex;

          const ev = tickerList[tickerIndex];
          const evTime = (ev?.startTime || "").slice(0, 5);
          const evTitle = ev?.title || "Actividad";
          const evPlace = App.util?.shortPlaceName?.(ev?.placeName) || "";

          tickerEl.textContent = `${evTime ? `${evTime} · ` : ""}${evTitle}${evPlace ? ` · ${evPlace}` : ""}`;

          tickerEl.classList.remove("is-leaving");
          tickerEl.classList.add("is-entering");

          window.setTimeout(() => {
            tickerEl.classList.remove("is-entering");
          }, 320);
        }, 220);
      }, 3700);
    }
  }
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
    App.ui.bindMapDateUI?.();
    App.ui.renderMapDateUI?.();
    App.ui.renderFestivalHero?.();
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
  App.ui.renderFestivalHero = renderFestivalHero;
  App.ui.renderMapDateUI = renderMapDateUI;
  App.ui.bindMapDateUI = bindMapDateUI;
  App.ui.setSelectedMapDate = setSelectedMapDate;

  App.renderAll = renderAll;
  App.commit = commit;
})();