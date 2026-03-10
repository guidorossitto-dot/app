// ui-render.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  function renderAll(opts = {}) {
    const rebuildMarkers = opts.rebuildMarkers ?? true;
    const recomputeNearby = opts.recomputeNearby ?? true;

    if (
      recomputeNearby &&
      App.state?.nearbyCenter &&
      App.map?.recomputeNearbyEvents
    ) {
      App.map.recomputeNearbyEvents(
        App.state.nearbyCenter.lat,
        App.state.nearbyCenter.lng
      );
    }

    App.ui?.renderAppShell?.();
    App.ui?.renderList?.();
    App.ui?.renderCalendar?.();

    App.map?.renderMap?.({ rebuildMarkers });
  }

  function commit(opts = {}) {
    const {
      persist = true,
      purgePast = true,
      rebuildMarkers = true,
      recomputeNearby = true
    } = opts;

    if (purgePast) {
      const purged = App.events?.purgePastEventsInState?.();
      if (persist && purged?.changed) {
        App.events?.persistEvents?.();
      }
    }

    if (persist) {
      App.events?.persistEvents?.();
      App.events?.persistLoginState?.();
    }

    renderAll({ rebuildMarkers, recomputeNearby });
  }

  App.renderAll = renderAll;
  App.commit = commit;
})();