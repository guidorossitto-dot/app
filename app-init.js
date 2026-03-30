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

  const loadedEvents = await App.storage.loadEvents();

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

  window.addEventListener("beforeinstallprompt", (event) => {
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

bindInstallPrompt();

  function bindUI() {
  App.ui.bindLoginUI();
  App.ui.bindPublicUI();
  App.ui.bindSidebarUI();
  App.ui.bindCalendarUI();
  App.ui.bindCategoryUI();
  App.ui.bindDeleteEventUI();
  App.ui.bindAdminUI();
}

  function initMapState() {
    App.map.bindAdminCategoryChips();
    App.map.initMap(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map.setUserLocation(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map.recomputeNearbyEvents(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
  }

  function startAutoRefresh() {
    setInterval(() => {
      if (state.logic.nearbyCenter) {
  App.map.recomputeNearbyEvents(
    state.logic.nearbyCenter.lat,
    state.logic.nearbyCenter.lng
  );
}

        App.renderAll?.({ rebuildMarkers: false });
    }, App.CFG.REFRESH_MS);
  }
  
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