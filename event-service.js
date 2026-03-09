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

  function getAllEvents() {
    return ensureEventsArray();
  }

  function findEventById(eventId) {
    const id = String(eventId || "").trim();
    if (!id) return null;
    return ensureEventsArray().find((ev) => String(ev.id) === id) || null;
  }

  function setAllEvents(list) {
    state.events = sanitizeEventsList(list);
    return state.events;
  }

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

  function commit(opts = {}) {
    if (App.commit) {
      App.commit(opts);
      return;
    }

    const {
      persist = true,
      purgePast = true,
      rebuildMarkers = true,
      recomputeNearby = true
    } = opts;

    if (purgePast) {
      storage.purgePastEvents();
    }

    if (persist) {
      storage.saveEvents();
    }

    if (recomputeNearby && state.nearbyCenter && App.map?.recomputeNearbyEvents) {
      App.map.recomputeNearbyEvents(
        state.nearbyCenter.lat,
        state.nearbyCenter.lng
      );
    }

    App.renderAll?.({ rebuildMarkers });
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
    setAllEvents,
    findEventById,
    addEvent,
    replaceEvent,
    removeEvent,
    clearAllEvents,

    setActiveCategory,
    setCalendarCursor,
    setEditingEventId,
    setNearbyCenter,
    setNearbyEvents,

    commit,
    saveAndRefresh
  };
})();