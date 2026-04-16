// app-init.js
(() => {
  "use strict";

  const App = window.App;
  const { state } = App;

async function hydrateInitialState() {
  const venuesRemote = await App.venues.loadVenuesRemote();

  if (!venuesRemote?.ok) {
    await App.storage?.loadVenues?.();
  }

  const favs = JSON.parse(localStorage.getItem("recomentos.favorites") || "[]");
  App.events?.setFavorites?.(favs);

  App.store.dispatch({
    type: "SET_FAVORITES",
    favorites: favs
  });

  let loadedEvents = { ok: false, events: [] };

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    loadedEvents = await App.storage.loadEvents();

    const count = Array.isArray(loadedEvents?.events)
      ? loadedEvents.events.length
      : 0;



    if (loadedEvents?.ok && count > 0) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (loadedEvents?.ok) {
    App.events?.setAllEvents?.(loadedEvents.events || []);
  } else {
    App.events?.setAllEvents?.([]);
  }

  (state.logic.events || []).forEach((ev) => {
    if (!ev?.placeName || !Number.isFinite(ev?.lat) || !Number.isFinite(ev?.lng)) return;

    App.venues.addVenue(
      { name: ev.placeName, address: ev.placeName, lat: ev.lat, lng: ev.lng },
      { persist: false }
    );
  });



  await App.auth?.syncSessionToState?.();


  App.events.purgePastEventsInState();


  App.events.setCalendarCursor(new Date());

}

let deferredInstallPrompt = null;

function bindInstallPrompt() {
  const installBtn = document.getElementById("installAppBtn");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    console.log("🔥 beforeinstallprompt disparó");
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    installBtn.hidden = true;
    deferredInstallPrompt.prompt();

    try {
      await deferredInstallPrompt.userChoice;
    } catch (err) {
      console.warn("No se pudo completar el prompt de instalación:", err);
    }

    deferredInstallPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installBtn.hidden = true;
    console.log("App instalada correctamente");
  });
}

function bindMapLocateBtn() {
  const btn = document.getElementById("mapLocateBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    App.map?.useMyLocation?.();
  });
}

function bindMapFiltersToggle() {
  const btn = document.getElementById("toggleMapFiltersBtn");
  const panel = document.getElementById("mapFiltersPanel");
  if (!btn || !panel) return;

  function setState(open) {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open
      ? "🎛️ Filtros ▴"
      : "🎛️ Filtros ▾";
  }

  btn.addEventListener("click", () => {
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    setState(!isOpen);
  });

  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target) && !panel.contains(e.target)) {
      setState(false);
    }
  });

  // estado inicial
  setState(false);
}


bindInstallPrompt();

function bindUI() {
  App.ui.bindLoginUI();
  App.ui.bindPublicUI();
  App.ui.bindSidebarUI();
  App.ui.bindCalendarUI();
  App.ui.bindDiscoveryUI();
  App.ui.bindCategoryUI();
  App.ui.bindDeleteEventUI();
  bindMapFiltersToggle();
  bindMapLocateBtn();
  App.ui.bindAdminUI();
}

function initMapState() {
  const fallbackLat = App.CFG.DEFAULT_LAT;
  const fallbackLng = App.CFG.DEFAULT_LNG;

  App.map.bindAdminCategoryChips();
  App.map.initMap(fallbackLat, fallbackLng);

  // 👇 usar geolocalización automática con fallback
  App.map?.useMyLocation?.({
    silent: true,
    fallbackLat,
    fallbackLng
  });
}

function startAutoRefresh() {
  setInterval(() => {
    // no rerenderizar mientras el usuario está leyendo un popover del calendario
    if (document.getElementById("calendarEventPopover")) {
      return;
    }

    if (state.logic.nearbyCenter) {
      App.map.recomputeNearbyEvents(
        state.logic.nearbyCenter.lat,
        state.logic.nearbyCenter.lng
      );
    }

    App.renderAll?.({ rebuildMarkers: false });
  }, App.CFG.REFRESH_MS);
}

 async function refreshAppDataAfterReconnect() {
  try {
    const eventsResult = await App.storage.loadEvents();
    if (eventsResult?.ok && Array.isArray(eventsResult.events)) {
      App.store?.dispatch?.({
        type: "SET_ALL_EVENTS",
        events: eventsResult.events
      });
    }

    const venuesResult = await App.storage.loadVenuesRemote();
    if (venuesResult?.ok && Array.isArray(venuesResult.venues)) {
      App.venues?.replaceAllVenues?.(venuesResult.venues);
    }

    App.renderAll?.({
      rebuildMarkers: true,
      recomputeNearby: true
    });

    console.log("Reconexión detectada: datos refrescados");
  } catch (err) {
    console.warn("No se pudieron refrescar datos tras reconexión:", err);
  }
}

let reconnectRefreshTimer = null;

window.addEventListener("online", () => {
  clearTimeout(reconnectRefreshTimer);
  reconnectRefreshTimer = setTimeout(() => {
    refreshAppDataAfterReconnect();
  }, 800);
});
  
  async function bootAfterMapReady() {
    if (state.runtime.bootReady) return;

    await hydrateInitialState();
      bindUI();
      App.auth?.bindAuthListener?.();
      initMapState();

App.renderAll({ rebuildMarkers: true });

App.events?.setBootReady?.(true);

const h = (location.hash || "").replace(/^#/, "");
const params = new URLSearchParams(h);
const hasDate = !!(params.get("d") || "").trim();

if (hasDate) {
  App.actions?.queueCalendarDateFromHashFlow?.();
  App.actions?.processQueuedCalendarDateFlow?.();
} else {
  setTimeout(() => {
    App.ui.processQueuedDeepLink();
  }, 260);
}

startAutoRefresh();
  }

  App.init = App.init || {};
  App.init.bootAfterMapReady = bootAfterMapReady;

document.addEventListener("DOMContentLoaded", async () => {
  await App.init.bootAfterMapReady();
  });
})();