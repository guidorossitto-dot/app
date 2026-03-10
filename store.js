// store.js
(() => {
  "use strict";

  const App = window.App;
  const { state } = App;

  function ensureLogicEventsArray() {
    if (!Array.isArray(state.logic.events)) state.logic.events = [];
    return state.logic.events;
  }

  function dispatch(action = {}) {
    const type = String(action.type || "").trim();
    if (!type) return { ok: false, error: "MISSING_ACTION_TYPE" };

    switch (type) {
      /* =========================
         LOGIC
      ========================= */
      case "SET_ALL_EVENTS": {
        state.logic.events = Array.isArray(action.events) ? action.events : [];
        return { ok: true };
      }

      case "ADD_EVENT": {
        ensureLogicEventsArray().push(action.event);
        return { ok: true };
      }

      case "REPLACE_EVENT": {
        const id = String(action.eventId || "").trim();
        const list = ensureLogicEventsArray();
        const idx = list.findIndex((ev) => String(ev.id) === id);
        if (idx === -1) return { ok: false, error: "NOT_FOUND" };

        list[idx] = action.event;
        return { ok: true };
      }

      case "REMOVE_EVENT": {
        const id = String(action.eventId || "").trim();
        state.logic.events = ensureLogicEventsArray().filter((ev) => String(ev.id) !== id);
        return { ok: true };
      }

      case "CLEAR_ALL_EVENTS": {
        state.logic.events = [];
        return { ok: true };
      }

      case "SET_LOGIN_STATE": {
        state.logic.isLoggedIn = !!action.value;
        return { ok: true };
      }

      case "SET_ACTIVE_CATEGORY": {
        state.logic.activeCategory = action.value;
        return { ok: true };
      }

      case "SET_CALENDAR_CURSOR": {
        state.logic.calendarCursor = action.value instanceof Date ? action.value : new Date();
        return { ok: true };
      }

      case "SET_EDITING_EVENT_ID": {
        state.logic.editingEventId = action.value ? String(action.value).trim() : null;
        return { ok: true };
      }

      case "SET_NEARBY_CENTER": {
        state.logic.nearbyCenter = action.value || null;
        return { ok: true };
      }

      case "SET_NEARBY_EVENTS": {
        state.logic.nearbyEvents = Array.isArray(action.value) ? action.value : [];
        return { ok: true };
      }

      /* =========================
         RUNTIME
      ========================= */
      case "SET_PENDING_OPEN_EVENT_ID": {
        state.runtime.pendingOpenEventId = action.value ? String(action.value).trim() : null;
        return { ok: true };
      }

      case "CLEAR_PENDING_OPEN_EVENT_ID": {
        state.runtime.pendingOpenEventId = null;
        return { ok: true };
      }

      case "SET_PENDING_DEEP_LINK_EVENT_ID": {
        state.runtime.pendingDeepLinkEventId = action.value ? String(action.value).trim() : null;
        return { ok: true };
      }

      case "CLEAR_PENDING_DEEP_LINK_EVENT_ID": {
        state.runtime.pendingDeepLinkEventId = null;
        return { ok: true };
      }

      case "SET_BOOT_READY": {
        state.runtime.bootReady = !!action.value;
        return { ok: true };
      }

      case "SET_UI_PAN_ZOOM_IN_PROGRESS": {
        state.runtime.uiPanZoomInProgress = !!action.value;
        return { ok: true };
      }

      default:
        return { ok: false, error: "UNKNOWN_ACTION", type };
    }
  }

  function getState() {
    return state;
  }

  App.store = {
    dispatch,
    getState
  };
})();