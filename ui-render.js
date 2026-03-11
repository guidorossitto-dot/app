// ui-render.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  function renderAll(opts = {}) {
    const rebuildMarkers = opts.rebuildMarkers ?? true;
    const recomputeNearby = opts.recomputeNearby ?? true;

    if (
      recomputeNearby &&
      App.state?.logic?.nearbyCenter &&
      App.map?.recomputeNearbyEvents
    ) {
      App.map.recomputeNearbyEvents(
        App.state.logic.nearbyCenter.lat,
        App.state.logic.nearbyCenter.lng
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
      App.events?.purgePastEventsInState?.();
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