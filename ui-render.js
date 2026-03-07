// ui-render.js
(() => {
  "use strict";

  const App = window.App = window.App || {};

  function renderAll(opts = {}) {
    App.ui?.renderAppShell?.();
    App.ui?.renderList?.();
    App.ui?.renderCalendar?.();

    if (App.map?.renderMap) {
      App.map.renderMap({
        rebuildMarkers: opts.rebuildMarkers ?? true
      });
    }
  }

  function commit(opts = {}) {
    const {
      persist = true,
      purgePast = true,
      rebuildMarkers = true,
      recomputeNearby = true
    } = opts;

    if (purgePast) {
      App.storage?.purgePastEvents?.();
    }

    if (persist) {
      App.storage?.saveEvents?.();
    }

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

    renderAll({ rebuildMarkers });
  }

  App.renderAll = renderAll;
  App.commit = commit;
})();