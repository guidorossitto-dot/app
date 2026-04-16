// ui-calendar-bindings.js
(() => {
  "use strict";

  const App = window.App;
  const { state, util } = App;

 function bindCalendarUI() {
    const prevMonthBtn = document.getElementById("prevMonthBtn");
    const nextMonthBtn = document.getElementById("nextMonthBtn");

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        App.actions?.setCalendarMonth?.(
          new Date(
            state.logic.calendarCursor.getFullYear(),
            state.logic.calendarCursor.getMonth() - 1,
            1
          )
        );

App.ui?.clearListFocus?.();

        App.commit({
          persist: false,
          purgePast: false,
          rebuildMarkers: false,
          recomputeNearby: false
        });
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        App.actions?.setCalendarMonth?.(
          new Date(
            state.logic.calendarCursor.getFullYear(),
            state.logic.calendarCursor.getMonth() + 1,
            1
          )
        );

App.ui?.clearListFocus?.();

        App.commit({
          persist: false,
          purgePast: false,
          rebuildMarkers: false,
          recomputeNearby: false
        });
      });
    }
  }

  function bindDiscoveryUI() {
  if (App.state.runtime.bindings.discoveryUI) return;
  App.state.runtime.bindings.discoveryUI = true;

  const suggestBtn = document.getElementById("discoverySuggestBtn");
  const nextBtn = document.getElementById("discoveryNextBtn");
  const resetBtn = document.getElementById("discoveryResetBtn");
  const result = document.getElementById("discoveryResult");

  if (suggestBtn) {
    suggestBtn.addEventListener("click", () => {
      App.actions?.generateDiscoveryFlow?.();
      App.commit({
        persist: false,
        purgePast: false,
        rebuildMarkers: false,
        recomputeNearby: false
      });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      App.actions?.nextDiscoverySuggestionFlow?.();
      App.commit({
        persist: false,
        purgePast: false,
        rebuildMarkers: false,
        recomputeNearby: false
      });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      App.actions?.clearDiscoveryFlow?.();
      App.commit({
        persist: false,
        purgePast: false,
        rebuildMarkers: false,
        recomputeNearby: false
      });
    });
  }

  if (result) {
    result.addEventListener("click", (e) => {
      const mapBtn = e.target.closest(".discoveryMapBtn");
      const favBtn = e.target.closest(".discoveryFavBtn");

      if (mapBtn) {
        App.actions?.focusEventOnMapFlow?.({ button: mapBtn });
        return;
      }

      if (favBtn) {
        const eventId = decodeURIComponent((favBtn.dataset.eid || "").trim());
        if (!eventId) return;

        App.actions?.toggleFavorite?.(eventId);

        App.commit({
          persist: false,
          purgePast: false,
          rebuildMarkers: false,
          recomputeNearby: false
        });
      }
    });
  }
}

   App.ui = {
    ...(App.ui || {}),
    bindCalendarUI,
    bindDiscoveryUI
  };
})();