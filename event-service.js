// event-service.js
(() => {
  "use strict";

  const App = window.App;
  const { state, util, storage } = App;

  function ensureEventsArray() {
    if (!Array.isArray(state.events)) state.events = [];
    return state.events;
  }

  function sanitizeEventsList(list) {
    return (Array.isArray(list) ? list : [])
      .map((ev) => util.normalizeEvent(ev))
      .filter((ev) => util.isValidEvent(ev));
  }

  function hasEventId(eventId) {
    const id = String(eventId || "").trim();
    if (!id) return false;
    return ensureEventsArray().some((ev) => String(ev.id) === id);
  }

  /* =========================
     READ API
  ========================= */
  function getAllEvents() {
    return ensureEventsArray();
  }

  function findEventById(eventId) {
    const id = String(eventId || "").trim();
    if (!id) return null;
    return ensureEventsArray().find((ev) => String(ev.id) === id) || null;
  }

  /* =========================
     HYDRATION / PERSISTENCE BRIDGE
  ========================= */
  function setAllEvents(list) {
    state.events = sanitizeEventsList(list);
    return state.events;
  }

  function hydrateEventsFromStorage() {
    const loaded = storage?.readEvents?.() || [];
    state.events = sanitizeEventsList(loaded);
    return state.events;
  }

  function purgePastEventsInState() {
    const current = ensureEventsArray();
    const purged = storage?.purgePastEvents?.(current) || [];
    const changed = purged.length !== current.length;

    state.events = sanitizeEventsList(purged);
    return {
      changed,
      events: state.events
    };
  }

  function persistEvents() {
    storage?.saveEvents?.(state.events);
    return state.events;
  }

  function setLoginState(isLoggedIn) {
    state.isLoggedIn = !!isLoggedIn;
    return state.isLoggedIn;
  }

  function hydrateLoginFromStorage() {
    state.isLoggedIn = !!storage?.readLoginState?.();
    return state.isLoggedIn;
  }

  function persistLoginState() {
    storage?.saveLoginState?.(state.isLoggedIn);
    return state.isLoggedIn;
  }

  /* =========================
     EVENT WRITES
  ========================= */
  function addEvent(rawEvent) {
    const ev = util.normalizeEvent(rawEvent);

    if (!util.isValidEvent(ev)) {
      return { ok: false, error: "INVALID_EVENT", event: null };
    }

    if (!ev.id) {
      return { ok: false, error: "MISSING_ID", event: null };
    }

    if (hasEventId(ev.id)) {
      return { ok: false, error: "DUPLICATE_ID", event: null };
    }

    ensureEventsArray().push(ev);
    return { ok: true, error: null, event: ev };
  }

  function replaceEvent(eventId, patch = {}) {
    const id = String(eventId || "").trim();
    if (!id) {
      return { ok: false, error: "INVALID_ID", event: null };
    }

    const list = ensureEventsArray();
    const idx = list.findIndex((ev) => String(ev.id) === id);

    if (idx === -1) {
      return { ok: false, error: "NOT_FOUND", event: null };
    }

    const current = list[idx];
    const merged = util.normalizeEvent({
      ...current,
      ...patch,
      id: current.id
    });

    if (!util.isValidEvent(merged)) {
      return { ok: false, error: "INVALID_EVENT", event: null };
    }

    list[idx] = merged;
    return { ok: true, error: null, event: merged };
  }

  function removeEvent(eventId) {
    const id = String(eventId || "").trim();
    if (!id) {
      return { ok: false, error: "INVALID_ID", removedEvent: null };
    }

    const existing = findEventById(id);
    if (!existing) {
      return { ok: false, error: "NOT_FOUND", removedEvent: null };
    }

    state.events = ensureEventsArray().filter((ev) => String(ev.id) !== id);

    return {
      ok: true,
      error: null,
      removedEvent: existing
    };
  }

  function clearAllEvents() {
    state.events = [];
    return { ok: true, error: null };
  }

  /* =========================
     UI / APP STATE WRITES
  ========================= */
  function login() {
    return setLoginState(true);
  }

  function logout() {
    return setLoginState(false);
  }

  function setActiveCategory(category) {
    state.activeCategory =
      category === App.CFG.CATEGORY_ALL
        ? App.CFG.CATEGORY_ALL
        : util.normalizeCategory(category);

    return state.activeCategory;
  }

  function setCalendarCursor(date) {
    state.calendarCursor = date instanceof Date ? date : new Date();
    return state.calendarCursor;
  }

  function setEditingEventId(eventId) {
    state.editingEventId = eventId ? String(eventId).trim() : null;
    return state.editingEventId;
  }

  function setNearbyCenter(center) {
    if (!center || !util.isValidCoord(center.lat) || !util.isValidCoord(center.lng)) {
      state.nearbyCenter = null;
      return state.nearbyCenter;
    }

    state.nearbyCenter = {
      lat: Number(center.lat),
      lng: Number(center.lng)
    };

    return state.nearbyCenter;
  }

  function setNearbyEvents(list) {
    state.nearbyEvents = sanitizeEventsList(list);
    return state.nearbyEvents;
  }

  function setPendingOpenEventId(eventId) {
    state._pendingOpenEventId = eventId ? String(eventId).trim() : null;
    return state._pendingOpenEventId;
  }

  function clearPendingOpenEventId() {
    state._pendingOpenEventId = null;
    return state._pendingOpenEventId;
  }

  function setPendingDeepLinkEventId(eventId) {
    state._pendingDeepLinkEventId = eventId ? String(eventId).trim() : null;
    return state._pendingDeepLinkEventId;
  }

  function clearPendingDeepLinkEventId() {
    state._pendingDeepLinkEventId = null;
    return state._pendingDeepLinkEventId;
  }

  function setBootReady(flag) {
    state._bootReady = !!flag;
    return state._bootReady;
  }

  function setUiPanZoomInProgress(flag) {
    state._uiPanZoomInProgress = !!flag;
    return state._uiPanZoomInProgress;
  }

  /* =========================
     COMMIT / REFRESH
  ========================= */
  function commit(opts = {}) {
    if (typeof App.commit === "function") {
      App.commit(opts);
    }
  }

  function saveAndRefresh(opts = {}) {
    commit({
      persist: true,
      purgePast: false,
      rebuildMarkers: true,
      recomputeNearby: true,
      ...opts
    });
  }

  App.events = {
    getAllEvents,
    findEventById,

    setAllEvents,
    hydrateEventsFromStorage,
    purgePastEventsInState,
    persistEvents,

    setLoginState,
    hydrateLoginFromStorage,
    persistLoginState,

    addEvent,
    replaceEvent,
    removeEvent,
    clearAllEvents,

    login,
    logout,
    setActiveCategory,
    setCalendarCursor,
    setEditingEventId,
    setNearbyCenter,
    setNearbyEvents,

    setPendingOpenEventId,
    clearPendingOpenEventId,
    setPendingDeepLinkEventId,
    clearPendingDeepLinkEventId,
    setBootReady,
    setUiPanZoomInProgress,

    commit,
    saveAndRefresh
  };
})();