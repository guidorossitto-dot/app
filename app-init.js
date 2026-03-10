// app-init.js
(() => {
  "use strict";

  const App = window.App;
  const { state } = App;

  function bootAfterMapReady() {
    if (state.runtime.bootReady) return;

    App.events?.hydrateEventsFromStorage?.();
    App.events?.hydrateLoginFromStorage?.();

    const purged = App.events?.purgePastEventsInState?.();
    if (purged?.changed) {
      App.events?.persistEvents?.();
    }

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

    App.events?.setBootReady?.(true);
    App.ui?.processQueuedDeepLink?.();

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

  App.init = App.init || {};
  App.init.bootAfterMapReady = bootAfterMapReady;

  document.addEventListener("DOMContentLoaded", () => {
    App.init?.bootAfterMapReady?.();
  });
})();