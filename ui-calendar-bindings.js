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


  App.ui = {
    ...(App.ui || {}),
    bindCalendarUI
  };
})();