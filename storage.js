// storage.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;

  function saveEvents() {
    localStorage.setItem("events", JSON.stringify(state.events));
  }

  function sanitizeLoadedEvents(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
      .map((ev) => util.normalizeEvent(ev))
      .filter((ev) => util.isValidEvent(ev));
  }

  function loadEvents() {
    const stored = localStorage.getItem("events");

    if (!stored) {
      state.events = [];
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      state.events = sanitizeLoadedEvents(parsed);
    } catch {
      state.events = [];
    }
  }

  function saveLoginState() {
    localStorage.setItem("isLoggedIn", JSON.stringify(state.isLoggedIn));
  }

  function loadLoginState() {
    const stored = localStorage.getItem("isLoggedIn");
    state.isLoggedIn = stored ? JSON.parse(stored) : false;
  }

  function purgePastEvents() {
    const today = util.todayStrYYYYMMDD();
    const before = state.events.length;
    state.events = state.events.filter((ev) => ev?.date && ev.date >= today);
    return state.events.length !== before;
  }

  App.storage = {
    saveEvents,
    loadEvents,
    saveLoginState,
    loadLoginState,
    purgePastEvents
  };
})();