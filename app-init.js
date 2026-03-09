// app-init.js
(() => {
  "use strict";

  const App = window.App;
  const { state, storage } = App;

  function bootAfterMapReady() {
    if (state._bootReady) return;

    storage.loadEvents();
    storage.loadLoginState();
    if (storage.purgePastEvents()) storage.saveEvents();

    App.events?.setCalendarCursor?.(new Date());

    App.ui?.bindLoginUI?.();
    App.ui?.bindPublicUI?.();
    App.ui?.bindAdminUI?.();
    App.ui?.bindCalendarUI?.();
    App.ui?.bindCategoryUI?.();
    App.ui?.bindDeleteEventUI?.();
    App.ui?.bindSidebarUI?.();

    App.map?.bindAdminCategoryChips?.();

    App.map?.initMap?.(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map?.setUserLocation?.(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map?.recomputeNearbyEvents?.(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);

    App.renderAll?.({ rebuildMarkers: true });

    state._bootReady = true;
    App.ui?.processQueuedDeepLink?.();

    setInterval(() => {
      if (state.nearbyCenter && App.map?.recomputeNearbyEvents) {
        App.map.recomputeNearbyEvents(state.nearbyCenter.lat, state.nearbyCenter.lng);
      }

      App.renderAll?.({ rebuildMarkers: false });
    }, App.CFG.REFRESH_MS);
  }

  App.init = App.init || {};
  App.init.bootAfterMapReady = bootAfterMapReady;

  document.addEventListener("DOMContentLoaded", () => {
    App.init?.bootAfterMapReady?.();
  });
})();