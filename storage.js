// storage.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;

  const STORAGE_KEYS = {
    EVENTS: "events",
    LOGIN: "isLoggedIn"
  };

  /* =========================
     INTERNAL HELPERS
  ========================= */
  function safeParseJSON(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function sanitizeLoadedEvents(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
      .map((ev) => util.normalizeEvent(ev))
      .filter((ev) => util.isValidEvent(ev));
  }

  /* =========================
     EVENTS
  ========================= */
  function saveEvents() {
    const list = Array.isArray(state.events) ? state.events : [];
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(list));
  }

  function loadEvents() {
    const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);

    if (!stored) {
      state.events = [];
      return state.events;
    }

    const parsed = safeParseJSON(stored, []);
    state.events = sanitizeLoadedEvents(parsed);
    return state.events;
  }

  function purgePastEvents() {
    const today = util.todayStrYYYYMMDD();
    const before = Array.isArray(state.events) ? state.events.length : 0;

    state.events = (Array.isArray(state.events) ? state.events : []).filter(
      (ev) => ev?.date && ev.date >= today
    );

    return state.events.length !== before;
  }

  /* =========================
     LOGIN
  ========================= */
  function saveLoginState() {
    localStorage.setItem(STORAGE_KEYS.LOGIN, JSON.stringify(!!state.isLoggedIn));
  }

  function loadLoginState() {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGIN);
    const parsed = safeParseJSON(stored, false);
    state.isLoggedIn = !!parsed;
    return state.isLoggedIn;
  }

  App.storage = {
    saveEvents,
    loadEvents,
    saveLoginState,
    loadLoginState,
    purgePastEvents
  };
})();