// storage.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;

  const STORAGE_KEYS = {
    LOGIN: "recomentos.isLoggedIn"
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

  function mapRowToEvent(row) {
    return util.normalizeEvent({
      id: row.id,
      title: row.title,
      placeName: row.place_name || "",
      date: row.date || "",
      startTime: row.start_time || "",
      category: row.category || "music",
      lat: Number(row.lat),
      lng: Number(row.lng)
    });
  }

  function mapEventToRow(ev) {
    const safe = util.normalizeEvent(ev);

    return {
      id: safe.id,
      title: safe.title,
      place_name: safe.placeName || "",
      date: safe.date || null,
      start_time: safe.startTime || null,
      category: safe.category || "music",
      lat: Number(safe.lat),
      lng: Number(safe.lng),
      updated_at: new Date().toISOString()
    };
  }

  /* =========================
     EVENTS
  ========================= */
  async function loadEvents() {
  const db = App.supabase;
  if (!db) {
    console.error("App.supabase no está inicializado");
    state.logic.events = [];
    return [];
  }

  const { data, error } = await db
    .from("events")
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error cargando eventos:", error);
    state.logic.events = [];
    return [];
  }

  // 👇 chequeo 1: ver exactamente lo que devuelve Supabase
  console.log("RAW rows from Supabase:");
  console.table(data);

  const events = Array.isArray(data)
    ? data.map(mapRowToEvent).filter((ev) => util.isValidEvent(ev))
    : [];

  // 👇 chequeo 2: ver los eventos ya normalizados en la app
  console.log("Normalized events in state:");
  console.table(
    events.map(ev => ({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      placeName: ev.placeName
    }))
  );

  state.logic.events = events;
  return events;
}

async function insertEvent(ev) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const row = mapEventToRow(ev);

  const { data, error } = await db
    .from("events")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("Error insertando evento:", error);
    return { ok: false, error };
  }

  return { ok: true, event: mapRowToEvent(data) };
}

  function readEvents() {
    return Array.isArray(state.logic.events) ? state.logic.events : [];
  }

  async function updateEvent(eventId, patch) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const id = String(eventId || "").trim();
  if (!id) {
    return { ok: false, error: "INVALID_ID" };
  }

  const safe = util.normalizeEvent({
    id,
    ...patch
  });

  const { data, error } = await db.rpc("update_event_by_id", {
    p_id: id,
    p_title: safe.title,
    p_place_name: safe.placeName || "",
    p_date: safe.date || null,
    p_start_time: safe.startTime || null,
    p_category: safe.category || "music",
    p_lat: Number(safe.lat),
    p_lng: Number(safe.lng)
  });

  if (error) {
    console.error("Error actualizando evento:", error);
    return { ok: false, error };
  }

  if (!data) {
    console.warn("La función SQL no actualizó ninguna fila", { id });
    return { ok: false, error: "UPDATE_FAILED" };
  }

  return { ok: true, event: safe };
}

  function purgePastEvents(list = state.logic.events) {
    const today = util.todayStrYYYYMMDD();
    const safeList = Array.isArray(list) ? list : [];

    return safeList.filter((ev) => ev?.date && ev.date >= today);
  }

  function hasPastEvents(list = state.logic.events) {
    const safeList = Array.isArray(list) ? list : [];
    const purged = purgePastEvents(safeList);
    return purged.length !== safeList.length;
  }

  async function saveEvents(list = state.logic.events) {
    console.warn("saveEvents quedó obsoleto con Supabase. Usar insert/update/delete.");
    return Array.isArray(list) ? list : [];
  }

  async function deleteEvent(eventId) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const id = String(eventId || "").trim();
  if (!id) {
    return { ok: false, error: "INVALID_ID" };
  }

  const { data, error } = await db.rpc("delete_event_by_id", {
    p_id: id
  });

  if (error) {
    console.error("Error borrando evento:", error);
    return { ok: false, error };
  }

  if (!data) {
    console.warn("La función SQL no borró ninguna fila", { id });
    return { ok: false, error: "DELETE_FAILED" };
  }

  return { ok: true };
}

async function deleteAllEvents() {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const { data, error } = await db.rpc("delete_all_events");

  console.log("deleteAllEvents RPC response:", { data, error });

  if (error) {
    console.error("Error borrando todos los eventos:", error);
    return { ok: false, error };
  }

  const deletedCount = Number(data);

  if (!Number.isFinite(deletedCount)) {
    console.warn("delete_all_events devolvió un valor inesperado", data);
    return { ok: false, error: "INVALID_DELETE_ALL_RESPONSE" };
  }

  return {
    ok: true,
    deletedCount
  };
}

  /* =========================
     LOGIN
  ========================= */
  function saveLoginState(value = state.logic.isLoggedIn) {
    localStorage.setItem(STORAGE_KEYS.LOGIN, JSON.stringify(!!value));
  }

  function readLoginState() {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGIN);
    const parsed = safeParseJSON(stored, false);
    return !!parsed;
  }

  App.storage = {
    loadEvents,
    readEvents,
    saveEvents,
    purgePastEvents,
    hasPastEvents,
    deleteEvent,
    deleteAllEvents,
    saveLoginState,
    readLoginState,
    updateEvent,
    insertEvent,

    mapRowToEvent,
    mapEventToRow
  };
})();