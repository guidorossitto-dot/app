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
      .map(ev => {
        const lat = Number(ev.lat);
        const lng = Number(ev.lng);
        const id = (ev.id ?? "").toString().trim() || util.newId();

        return {
          id,
          title: (ev.title ?? "").toString(),
          date: (ev.date ?? "").toString(),
          lat,
          lng,
          placeName: (ev.placeName ?? "").toString(),
          startTime: (ev.startTime ?? "").toString(),
          category: util.normalizeCategory(ev.category)
        };
      })
      .filter(ev => ev.title && ev.date && util.isValidCoord(ev.lat) && util.isValidCoord(ev.lng));
  }

  function loadEvents() {
    const stored = localStorage.getItem("events");
    const parsed = stored ? JSON.parse(stored) : [];
    state.events = sanitizeLoadedEvents(parsed);
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
    state.events = state.events.filter(ev => ev?.date && ev.date >= today);
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