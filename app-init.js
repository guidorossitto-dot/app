// app-init.js
(() => {
  "use strict";

  const App = window.App;
  const { state } = App;

  async function hydrateInitialState() {
    await App.storage?.loadEvents?.();

    if (App.events?.hydrateLoginFromStorage) {
      App.events.hydrateLoginFromStorage();
    } else if (App.storage?.readLoginState) {
      state.logic.isLoggedIn = App.storage.readLoginState();
    }

    if (App.events?.purgePastEventsInState) {
      const purged = App.events.purgePastEventsInState();
      if (purged?.changed) {
        console.warn("Hay eventos pasados en estado. Más adelante los limpiaremos también en Supabase.");
      }
    }

    App.events?.setCalendarCursor?.(new Date());
  }

  function bindUI() {
    App.ui?.bindLoginUI?.();
    App.ui?.bindPublicUI?.();
    App.ui?.bindAdminUI?.();
    App.ui?.bindCalendarUI?.();
    App.ui?.bindCategoryUI?.();
    App.ui?.bindDeleteEventUI?.();
    App.ui?.bindSidebarUI?.();
  }

  function initMapState() {
    App.map?.bindAdminCategoryChips?.();
    App.map?.initMap?.(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map?.setUserLocation?.(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map?.recomputeNearbyEvents?.(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
  }

  function startAutoRefresh() {
    setInterval(() => {
      if (state.logic.nearbyCenter && App.map?.recomputeNearbyEvents) {
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
    initMapState();

    App.renderAll?.({ rebuildMarkers: true });

    if (App.events?.setBootReady) {
      App.events.setBootReady(true);
    } else {
      state.runtime.bootReady = true;
    }

    App.ui?.processQueuedDeepLink?.();

    startAutoRefresh();
  }

  App.init = App.init || {};
  App.init.bootAfterMapReady = bootAfterMapReady;

  document.addEventListener("DOMContentLoaded", async () => {
    await App.init?.bootAfterMapReady?.();
  });
})();