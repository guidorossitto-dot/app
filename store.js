// store.js
(() => {
  "use strict";

  const App = window.App;
  const { state } = App;
  const listeners = new Set();

  function ensureLogicEventsArray() {
    if (!Array.isArray(state.logic.events)) state.logic.events = [];
    return state.logic.events;
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function notify(action, result) {
    listeners.forEach((listener) => {
      try {
        listener(state, action, result);
      } catch (err) {
        console.error("Store subscriber error:", err);
      }
    });
  }

  function dispatch(action = {}) {
    const type = String(action.type || "").trim();
    if (!type) return { ok: false, error: "MISSING_ACTION_TYPE" };

    let result = null;

    switch (type) {
      /* =========================
         LOGIC
      ========================= */
      case "SET_ALL_EVENTS": {
        state.logic.events = Array.isArray(action.events) ? action.events : [];
        result = { ok: true };
        break;
      }

      case "ADD_EVENT": {
        if (!action.event || typeof action.event !== "object") {
          return { ok: false, error: "INVALID_EVENT" };
        }

        ensureLogicEventsArray().push(action.event);
        result = { ok: true };
        break;
      }

      case "REPLACE_EVENT": {
        const id = String(action.eventId || "").trim();
        if (!id) return { ok: false, error: "MISSING_EVENT_ID" };

        if (!action.event || typeof action.event !== "object") {
          return { ok: false, error: "INVALID_EVENT" };
        }

        const list = ensureLogicEventsArray();
        const idx = list.findIndex((ev) => String(ev.id) === id);
        if (idx === -1) return { ok: false, error: "NOT_FOUND" };

        list[idx] = action.event;
        result = { ok: true };
        break;
      }

      case "REMOVE_EVENT": {
        const id = String(action.eventId || "").trim();
        if (!id) return { ok: false, error: "MISSING_EVENT_ID" };

        const list = ensureLogicEventsArray();
        const before = list.length;

        state.logic.events = list.filter((ev) => String(ev.id) !== id);

        result =
          state.logic.events.length !== before
            ? { ok: true }
            : { ok: false, error: "NOT_FOUND" };
        break;
      }

      case "CLEAR_ALL_EVENTS": {
        state.logic.events = [];
        result = { ok: true };
        break;
      }

      case "SET_LOGIN_STATE": {
        state.logic.isLoggedIn = !!action.value;
        result = { ok: true };
        break;
      }

      case "SET_ACTIVE_CATEGORY": {
        state.logic.activeCategory = action.value;
        result = { ok: true };
        break;
      }

      case "SET_CALENDAR_CURSOR": {
        state.logic.calendarCursor =
          action.value instanceof Date ? action.value : new Date();
        result = { ok: true };
        break;
      }

      case "SET_EDITING_EVENT_ID": {
        state.logic.editingEventId = action.value
          ? String(action.value).trim()
          : null;
        result = { ok: true };
        break;
      }

      case "SET_NEARBY_CENTER": {
        state.logic.nearbyCenter = action.value || null;
        result = { ok: true };
        break;
      }

      case "SET_NEARBY_EVENTS": {
        state.logic.nearbyEvents = Array.isArray(action.value) ? action.value : [];
        result = { ok: true };
        break;
      }

      /* =========================
         RUNTIME
      ========================= */
      case "SET_PENDING_OPEN_EVENT_ID": {
        state.runtime.pendingOpenEventId = action.value
          ? String(action.value).trim()
          : null;
        result = { ok: true };
        break;
      }

      case "CLEAR_PENDING_OPEN_EVENT_ID": {
        state.runtime.pendingOpenEventId = null;
        result = { ok: true };
        break;
      }

      case "SET_PENDING_DEEP_LINK_EVENT_ID": {
        state.runtime.pendingDeepLinkEventId = action.value
          ? String(action.value).trim()
          : null;
        result = { ok: true };
        break;
      }

      case "CLEAR_PENDING_DEEP_LINK_EVENT_ID": {
        state.runtime.pendingDeepLinkEventId = null;
        result = { ok: true };
        break;
      }

      case "SET_BOOT_READY": {
        state.runtime.bootReady = !!action.value;
        result = { ok: true };
        break;
      }

      case "SET_UI_PAN_ZOOM_IN_PROGRESS": {
        state.runtime.uiPanZoomInProgress = !!action.value;
        result = { ok: true };
        break;
      }

      default:
        return { ok: false, error: "UNKNOWN_ACTION", type };
    }

    if (result?.ok) notify(action, result);
    return result;
  }

  App.store = {
    dispatch,
    getState,
    subscribe
  };
})();