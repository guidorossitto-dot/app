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

    function formatYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function generateDailyOccurrences(baseEvent, startDate, endDate) {
    const out = [];

    if (!baseEvent || !startDate || !endDate) return out;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
    if (start > end) return out;

    const cur = new Date(start);
    const seriesId = util.newId();

    while (cur <= end) {
      out.push({
        ...baseEvent,
        id: util.newId(),
        date: formatYMD(cur),
        seriesId,
        recurrenceType: "daily",
        recurrenceInterval: 1,
        recurrenceUntil: endDate
      });

      cur.setDate(cur.getDate() + 1);

      if (out.length > 60) break;
    }

    return out;
  }

  function buildEventsFromCreateMode(baseEvent, options = {}) {
    const mode = String(options.mode || "single").trim();
    const startDate = String(options.startDate || "").trim();
    const endDate = String(options.endDate || "").trim();

    if (!baseEvent || typeof baseEvent !== "object") {
      return { ok: false, error: "INVALID_BASE_EVENT" };
    }

    if (mode === "dailyRange") {
      if (!startDate || !endDate) {
        return {
          ok: false,
          error: "MISSING_RANGE",
          message: "Completá fecha inicio y fecha fin."
        };
      }

      const events = generateDailyOccurrences(baseEvent, startDate, endDate);

      if (!events.length) {
        return {
          ok: false,
          error: "EMPTY_OCCURRENCES",
          message: "No se pudieron generar ocurrencias. Revisá el rango de fechas."
        };
      }

      if (events.length > 60) {
        return {
          ok: false,
          error: "TOO_MANY_OCCURRENCES",
          message: "Demasiadas ocurrencias. Reducí el rango."
        };
      }

      return { ok: true, events };
    }

    if (mode === "weeklyRange") {
      if (!startDate || !endDate) {
        return {
          ok: false,
          error: "MISSING_RANGE",
          message: "Completá fecha inicio y fecha fin."
        };
      }

      const events = generateWeeklyOccurrences(baseEvent, startDate, endDate);

      if (!events.length) {
        return {
          ok: false,
          error: "EMPTY_OCCURRENCES",
          message: "No se pudieron generar ocurrencias semanales. Revisá el rango."
        };
      }

      if (events.length > 60) {
        return {
          ok: false,
          error: "TOO_MANY_OCCURRENCES",
          message: "Demasiadas ocurrencias. Reducí el rango."
        };
      }

      return { ok: true, events };
    }

    return {
      ok: true,
      events: [
        {
          id: util.newId(),
          seriesId: "",
          recurrenceType: "",
          recurrenceInterval: null,
          recurrenceUntil: "",
          ...baseEvent
        }
      ]
    };
  }

  function generateWeeklyOccurrences(baseEvent, startDate, endDate) {
    const out = [];

    if (!baseEvent || !startDate || !endDate) return out;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
    if (start > end) return out;

    const cur = new Date(start);
    const seriesId = util.newId();

    while (cur <= end) {
      out.push({
        ...baseEvent,
        id: util.newId(),
        date: formatYMD(cur),
        seriesId,
        recurrenceType: "weekly",
        recurrenceInterval: 1,
        recurrenceUntil: endDate
      });

      cur.setDate(cur.getDate() + 7);

      if (out.length > 60) break;
    }

    return out;
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

  function getEventsBySeriesId(seriesId) {
  const id = String(seriesId || "").trim();
  if (!id) return [];

  const list = Array.isArray(state.logic.events) ? state.logic.events : [];
  return list.filter((ev) => String(ev?.seriesId || "").trim() === id);
}

function isRecurringEvent(eventId) {
  const ev = findEventById(eventId);
  if (!ev) return false;

  return !!String(ev.seriesId || "").trim();
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

function setEditingMode(mode) {
  App.store?.dispatch?.({
    type: "SET_EDITING_MODE",
    value: mode
  });

  return state.logic.editingMode;
}

function setEditingSeriesId(seriesId) {
  App.store?.dispatch?.({
    type: "SET_EDITING_SERIES_ID",
    value: seriesId
  });

  return state.logic.editingSeriesId;
}

  function hydrateLoginFromStorage() {
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

async function addEventsRemote(list = []) {
  const safeList = Array.isArray(list) ? list : [];

  if (!safeList.length) {
    return {
      ok: false,
      error: "EMPTY_EVENTS_LIST",
      createdCount: 0,
      events: []
    };
  }

  const createdEvents = [];

  for (const rawEvent of safeList) {
    const result = await addEventRemote(rawEvent);

    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || "BATCH_ADD_FAILED",
        failedIndex: createdEvents.length,
        createdCount: createdEvents.length,
        events: createdEvents
      };
    }

    createdEvents.push(result.event);
  }

  return {
    ok: true,
    createdCount: createdEvents.length,
    events: createdEvents
  };
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
  event: updated.event
});

  if (!out?.ok) {
    return { ok: false, error: out?.error || "STORE_ERROR", event: null };
  }

  return { ok: true, error: null, event: updated.event };
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

async function removeSeries(seriesId) {
  const id = String(seriesId || "").trim();
  if (!id) return { ok: false, error: "INVALID_SERIES_ID" };

  const seriesEvents = getEventsBySeriesId(id);
  if (!seriesEvents.length) {
    return { ok: false, error: "SERIES_NOT_FOUND" };
  }

  for (const ev of seriesEvents) {
    const result = await removeEvent(ev.id);
    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || "REMOVE_SERIES_FAILED",
        failedEventId: ev.id
      };
    }
  }

  return {
    ok: true,
    removedCount: seriesEvents.length
  };
}

async function replaceSeries(seriesId, patch = {}) {
  const id = String(seriesId || "").trim();
  if (!id) return { ok: false, error: "INVALID_SERIES_ID" };

  const seriesEvents = getEventsBySeriesId(id);
  if (!seriesEvents.length) {
    return { ok: false, error: "SERIES_NOT_FOUND" };
  }

  const updatedEvents = [];

  for (const ev of seriesEvents) {
    const nextPatch = {
  ...patch,

  id: ev.id,
  date: ev.date,

  seriesId: ev.seriesId || id,
  recurrenceType: ev.recurrenceType || patch.recurrenceType || "",
  recurrenceInterval: Number.isFinite(ev.recurrenceInterval)
    ? ev.recurrenceInterval
    : (patch.recurrenceInterval ?? null),
  recurrenceUntil: ev.recurrenceUntil || patch.recurrenceUntil || ""
};

    const result = await replaceEvent(ev.id, nextPatch);

    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || "REPLACE_SERIES_FAILED",
        failedEventId: ev.id,
        updatedEvents
      };
    }

    updatedEvents.push(result.event || null);
  }

  return {
    ok: true,
    updatedCount: updatedEvents.length,
    events: updatedEvents
  };
}

async function saveEditedEvent(editState = {}, patch = {}) {
  const editingEventId = String(editState.editingEventId || "").trim();
  const editingMode = String(editState.editingMode || "single").trim();
  const editingSeriesId = String(editState.editingSeriesId || "").trim();

  if (!editingEventId) {
    return { ok: false, error: "MISSING_EDITING_EVENT_ID" };
  }

  if (editingMode === "series" && editingSeriesId) {
    const result = await replaceSeries(editingSeriesId, patch);

    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || "SAVE_EDIT_SERIES_FAILED"
      };
    }

    return {
      ok: true,
      mode: "series",
      updatedCount: result.updatedCount || 0,
      events: result.events || []
    };
  }

  const result = await replaceEvent(editingEventId, patch);

  if (!result?.ok) {
    return {
      ok: false,
      error: result?.error || "SAVE_EDIT_SINGLE_FAILED"
    };
  }

  return {
    ok: true,
    mode: "single",
    updatedCount: 1,
    event: result.event || null
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

async function clearPastEvents() {
  const deleted = await storage?.deletePastEvents?.();

  if (!deleted?.ok) {
    return {
      ok: false,
      error: deleted?.error || "REMOTE_CLEAR_PAST_ERROR"
    };
  }

  const current = ensureEventsArray();
  const today = util.todayStrYYYYMMDD();
  const next = current.filter((ev) => (ev?.date || "") >= today);

  const out = App.store?.dispatch?.({
    type: "SET_ALL_EVENTS",
    events: next
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
  return state.logic.isLoggedIn;
}

function logout() {
  return state.logic.isLoggedIn;
}

 const isAdminMode = util.isAdminMode;

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

  function setPendingCalendarDate(dateStr) {
  App.store?.dispatch?.({
    type: "SET_PENDING_CALENDAR_DATE",
    value: dateStr
  });
  return state.runtime.pendingCalendarDate;
}

function clearPendingCalendarDate() {
  App.store?.dispatch?.({
    type: "CLEAR_PENDING_CALENDAR_DATE"
  });
  return state.runtime.pendingCalendarDate;
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

  function setFavorites(favs) {
  App.store.dispatch({
    type: "SET_FAVORITES",
    favorites: favs
  });
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

  function setFavorites(favs = []) {
  const safe = Array.isArray(favs)
    ? favs.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  App.store?.dispatch?.({
    type: "SET_FAVORITES",
    favorites: safe
  });

  return state.logic.favorites;
}

function isFavorite(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return false;

  const favs = Array.isArray(state.logic.favorites) ? state.logic.favorites : [];
  return favs.includes(id);
}

function toggleFavorite(eventId) {
  const id = String(eventId || "").trim();
  if (!id) {
    return { ok: false, error: "INVALID_EVENT_ID", favorites: state.logic.favorites || [] };
  }

  const current = Array.isArray(state.logic.favorites) ? state.logic.favorites : [];
  const next = current.includes(id)
    ? current.filter((favId) => favId !== id)
    : [...current, id];

  App.store?.dispatch?.({
    type: "SET_FAVORITES",
    favorites: next
  });

  try {
    localStorage.setItem("recomentos.favorites", JSON.stringify(next));
  } catch (err) {
    console.error("No se pudieron guardar favoritos en localStorage.", err);
  }

  return {
    ok: true,
    isFavorite: next.includes(id),
    favorites: next
  };
}

    App.events = {
    getAllEvents,
    findEventById,

    setAllEvents,
    hydrateEventsFromStorage,
    purgePastEventsInState,
    persistEvents,

    getEventsBySeriesId,
    isRecurringEvent,
    generateDailyOccurrences,
    generateWeeklyOccurrences,
    buildEventsFromCreateMode,
    removeSeries,
    replaceSeries,
    saveEditedEvent,

    setLoginState,

    addEvent,
    replaceEvent,

    addEventRemote,
    addEventsRemote,
    removeEvent,
    clearAllEvents,
    clearPastEvents,

    isAdminMode,
    setActiveCategory,
    setCalendarCursor,
    setEditingEventId,
    setEditingMode,
    setEditingSeriesId,
    setNearbyCenter,
    setNearbyEvents,

    setPendingCalendarDate,
    clearPendingCalendarDate,
    setPendingOpenEventId,
    clearPendingOpenEventId,
    setPendingDeepLinkEventId,
    clearPendingDeepLinkEventId,
    setBootReady,
    setUiPanZoomInProgress,
    setFavorites,
    setFavorites,
    isFavorite,
    toggleFavorite,

    commit,
    saveAndRefresh
  };
})();