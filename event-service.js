// event-service.js
(() => {
  "use strict";

  const App = window.App;
  const { state, util, storage } = App;

  function ensureEventsArray() {
    if (!Array.isArray(state.logic.events)) state.logic.events = [];
    return state.logic.events;
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
    const safe = sanitizeEventsList(list);
    App.store?.dispatch?.({
      type: "SET_ALL_EVENTS",
      events: safe
    });
    return state.logic.events;
  }

  function hydrateEventsFromStorage() {
    const loaded = storage?.readEvents?.() || [];
    const safe = sanitizeEventsList(loaded);

    App.store?.dispatch?.({
      type: "SET_ALL_EVENTS",
      events: safe
    });

    return state.logic.events;
  }

  function purgePastEventsInState() {
    const current = ensureEventsArray();
    const purged = storage?.purgePastEvents?.(current) || [];
    const changed = purged.length !== current.length;
    const safe = sanitizeEventsList(purged);

    App.store?.dispatch?.({
      type: "SET_ALL_EVENTS",
      events: safe
    });

    return {
      changed,
      events: state.logic.events
    };
  }

  function persistEvents() {
    storage?.saveEvents?.(state.logic.events);
    return state.logic.events;
  }

  function setLoginState(isLoggedIn) {
    App.store?.dispatch?.({
      type: "SET_LOGIN_STATE",
      value: !!isLoggedIn
    });
    return state.logic.isLoggedIn;
  }

  function hydrateLoginFromStorage() {
    const value = !!storage?.readLoginState?.();
    App.store?.dispatch?.({
      type: "SET_LOGIN_STATE",
      value
    });
    return state.logic.isLoggedIn;
  }

  function persistLoginState() {
    storage?.saveLoginState?.(state.logic.isLoggedIn);
    return state.logic.isLoggedIn;
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

    const out = App.store?.dispatch?.({
      type: "ADD_EVENT",
      event: ev
    });

    if (!out?.ok) {
      return { ok: false, error: out?.error || "STORE_ERROR", event: null };
    }

    return { ok: true, error: null, event: ev };
  }

  async function addEventRemote(rawEvent) {
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

  const inserted = await storage?.insertEvent?.(ev);

  if (!inserted?.ok || !inserted.event) {
    return { ok: false, error: inserted?.error || "REMOTE_INSERT_ERROR", event: null };
  }

  const out = App.store?.dispatch?.({
    type: "ADD_EVENT",
    event: inserted.event
  });

  if (!out?.ok) {
    return { ok: false, error: out?.error || "STORE_ERROR", event: null };
  }

  return { ok: true, error: null, event: inserted.event };
}

  async function replaceEvent(eventId, patch = {}) {
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

  const updated = await storage?.updateEvent?.(id, merged);

  if (!updated?.ok) {
    return { ok: false, error: updated?.error || "REMOTE_UPDATE_ERROR", event: null };
  }

  const out = App.store?.dispatch?.({
    type: "REPLACE_EVENT",
    eventId: id,
    event: merged
  });

  if (!out?.ok) {
    return { ok: false, error: out?.error || "STORE_ERROR", event: null };
  }

  return { ok: true, error: null, event: merged };
}

 async function removeEvent(eventId) {
  const id = String(eventId || "").trim();
  if (!id) {
    return { ok: false, error: "INVALID_ID", removedEvent: null };
  }

  const existing = findEventById(id);
  if (!existing) {
    return { ok: false, error: "NOT_FOUND", removedEvent: null };
  }

  const deleted = await storage?.deleteEvent?.(id);
  if (!deleted?.ok) {
    return {
      ok: false,
      error: deleted?.error || "REMOTE_DELETE_ERROR",
      removedEvent: null
    };
  }

  const out = App.store?.dispatch?.({
    type: "REMOVE_EVENT",
    eventId: id
  });

  if (!out?.ok) {
    return {
      ok: false,
      error: out?.error || "STORE_ERROR",
      removedEvent: null
    };
  }

  return {
    ok: true,
    error: null,
    removedEvent: existing
  };
}

 async function clearAllEvents() {
  const deleted = await storage?.deleteAllEvents?.();

  if (!deleted?.ok) {
    return {
      ok: false,
      error: deleted?.error || "REMOTE_CLEAR_ALL_ERROR"
    };
  }

  const out = App.store?.dispatch?.({
    type: "CLEAR_ALL_EVENTS"
  });

  return {
    ok: !!out?.ok,
    error: out?.ok ? null : out?.error || "STORE_ERROR",
    deletedCount: deleted?.deletedCount || 0
  };
}

  /* =========================
     UI / APP STATE WRITES
  ========================= */
  function login() {
  setLoginState(true);
  persistLoginState();
  return state.logic.isLoggedIn;
}

function logout() {
  setLoginState(false);
  persistLoginState();
  return state.logic.isLoggedIn;
}

 function isAdminMode() {
  return !!util.isAdminMode();
}

function setActiveCategory(category) {
    const value =
      category === App.CFG.CATEGORY_ALL
        ? App.CFG.CATEGORY_ALL
        : util.normalizeCategory(category);

    App.store?.dispatch?.({
      type: "SET_ACTIVE_CATEGORY",
      value
    });

    return state.logic.activeCategory;
  }

  function setCalendarCursor(date) {
    App.store?.dispatch?.({
      type: "SET_CALENDAR_CURSOR",
      value: date
    });

    return state.logic.calendarCursor;
  }

  function setEditingEventId(eventId) {
    App.store?.dispatch?.({
      type: "SET_EDITING_EVENT_ID",
      value: eventId
    });

    return state.logic.editingEventId;
  }

  function setNearbyCenter(center) {
    if (!center || !util.isValidCoord(center.lat) || !util.isValidCoord(center.lng)) {
      App.store?.dispatch?.({
        type: "SET_NEARBY_CENTER",
        value: null
      });
      return state.logic.nearbyCenter;
    }

    App.store?.dispatch?.({
      type: "SET_NEARBY_CENTER",
      value: {
        lat: Number(center.lat),
        lng: Number(center.lng)
      }
    });

    return state.logic.nearbyCenter;
  }

  function setNearbyEvents(list) {
    const safe = sanitizeEventsList(list);

    App.store?.dispatch?.({
      type: "SET_NEARBY_EVENTS",
      value: safe
    });

    return state.logic.nearbyEvents;
  }

  function setPendingOpenEventId(eventId) {
    App.store?.dispatch?.({
      type: "SET_PENDING_OPEN_EVENT_ID",
      value: eventId
    });
    return state.runtime.pendingOpenEventId;
  }

  function clearPendingOpenEventId() {
    App.store?.dispatch?.({
      type: "CLEAR_PENDING_OPEN_EVENT_ID"
    });
    return state.runtime.pendingOpenEventId;
  }

  function setPendingDeepLinkEventId(eventId) {
    App.store?.dispatch?.({
      type: "SET_PENDING_DEEP_LINK_EVENT_ID",
      value: eventId
    });
    return state.runtime.pendingDeepLinkEventId;
  }

  function clearPendingDeepLinkEventId() {
    App.store?.dispatch?.({
      type: "CLEAR_PENDING_DEEP_LINK_EVENT_ID"
    });
    return state.runtime.pendingDeepLinkEventId;
  }

  function setBootReady(flag) {
    App.store?.dispatch?.({
      type: "SET_BOOT_READY",
      value: flag
    });
    return state.runtime.bootReady;
  }

  function setUiPanZoomInProgress(flag) {
    App.store?.dispatch?.({
      type: "SET_UI_PAN_ZOOM_IN_PROGRESS",
      value: flag
    });
    return state.runtime.uiPanZoomInProgress;
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
    addEventRemote,
    clearAllEvents,

    login,
    logout,
    isAdminMode,
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