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
  function saveEvents(list = state.events) {
    const safeList = Array.isArray(list) ? list : [];
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(safeList));
  }

  function readEvents() {
    const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!stored) return [];

    const parsed = safeParseJSON(stored, []);
    return sanitizeLoadedEvents(parsed);
  }

  function purgePastEvents(list = state.events) {
    const today = util.todayStrYYYYMMDD();
    const safeList = Array.isArray(list) ? list : [];

    return safeList.filter((ev) => ev?.date && ev.date >= today);
  }

  function hasPastEvents(list = state.events) {
    const safeList = Array.isArray(list) ? list : [];
    const purged = purgePastEvents(safeList);
    return purged.length !== safeList.length;
  }

  /* =========================
     LOGIN
  ========================= */
  function saveLoginState(value = state.isLoggedIn) {
    localStorage.setItem(STORAGE_KEYS.LOGIN, JSON.stringify(!!value));
  }

  function readLoginState() {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGIN);
    const parsed = safeParseJSON(stored, false);
    return !!parsed;
  }

  App.storage = {
    saveEvents,
    readEvents,
    purgePastEvents,
    hasPastEvents,

    saveLoginState,
    readLoginState
  };
})();