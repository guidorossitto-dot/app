//storage.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;

  const STORAGE_KEYS = {
  LOGIN: "recomentos.isLoggedIn",
  VENUES: "recomentos.venues",
  EVENTS_CACHE: "recomentos.events.cache",
  VENUES_CACHE: "recomentos.venues.cache"
};

  function safeParseJSON(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveEventsCache(events = []) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.EVENTS_CACHE,
      JSON.stringify(Array.isArray(events) ? events : [])
    );
    return { ok: true };
  } catch (err) {
    console.error("No se pudo guardar cache offline de eventos.", err);
    return { ok: false, error: err };
  }
}

function loadEventsCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS_CACHE);
    const parsed = safeParseJSON(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("No se pudo leer cache offline de eventos.", err);
    return [];
  }
}

function saveVenuesCache(venues = []) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.VENUES_CACHE,
      JSON.stringify(Array.isArray(venues) ? venues : [])
    );
    return { ok: true };
  } catch (err) {
    console.error("No se pudo guardar cache offline de venues.", err);
    return { ok: false, error: err };
  }
}

function loadVenuesCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENUES_CACHE);
    const parsed = safeParseJSON(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("No se pudo leer cache offline de venues.", err);
    return [];
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
    link: row.link || "",
    lat: Number(row.lat),
    lng: Number(row.lng),

    seriesId: row.series_id || "",
    recurrenceType: row.recurrence_type || "",
    recurrenceInterval: row.recurrence_interval,
    recurrenceUntil: row.recurrence_until || ""
  });
}

  function mapRowToVenue(row) {
  return {
    id: String(row.id || "").trim(),
    name: String(row.name || "").trim(),
    address: String(row.address || "").trim(),
    neighborhood: String(row.neighborhood || "").trim(),
    lat: Number(row.lat),
    lng: Number(row.lng),
    instagramUrl: String(row.instagram_url || "").trim(),
    websiteUrl: String(row.website_url || "").trim(),
    mapsUrl: String(row.maps_url || "").trim(),
    notes: String(row.notes || "").trim(),
    createdAt: String(row.created_at || "").trim(),
    updatedAt: String(row.updated_at || "").trim()
  };
}

function mapVenueToRow(venue) {
  return {
    id: venue.id,
    name: venue.name || "",
    address: venue.address || "",
    neighborhood: venue.neighborhood || "",
    lat: Number(venue.lat),
    lng: Number(venue.lng),
    instagram_url: venue.instagramUrl || "",
    website_url: venue.websiteUrl || "",
    maps_url: venue.mapsUrl || "",
    notes: venue.notes || "",
    created_at: venue.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function saveVenues() {
  try {
    const venues = Array.isArray(state.logic?.venues) ? state.logic.venues : [];
    localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(venues));
    return { ok: true, count: venues.length };
  } catch (err) {
    console.error("No se pudieron guardar los venues.", err);
    return { ok: false, error: err };
  }
}

function loadVenues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENUES);
    const parsed = safeParseJSON(raw, []);

    const result = App.venues?.replaceAllVenues?.(Array.isArray(parsed) ? parsed : []);
    return { ok: true, count: result?.count || 0 };
  } catch (err) {
    console.error("No se pudieron cargar los venues.", err);
    if (state.logic) state.logic.venues = [];
    return { ok: false, error: err };
  }
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
    link: safe.link || "",
    lat: Number(safe.lat),
    lng: Number(safe.lng),

    series_id: safe.seriesId || null,
    recurrence_type: safe.recurrenceType || null,
    recurrence_interval: Number.isFinite(safe.recurrenceInterval)
      ? safe.recurrenceInterval
      : null,
    recurrence_until: safe.recurrenceUntil || null,

    updated_at: new Date().toISOString()
  };
}

  async function loadEvents() {
  const db = App.supabase;
  if (!db) {
    console.error("App.supabase no está inicializado");
    const cachedEvents = loadEventsCache();
    return {
      ok: cachedEvents.length > 0,
      error: "SUPABASE_NOT_READY",
      events: cachedEvents
    };
  }

  try {
    const { data, error } = await db
      .from("events")
      .select("*")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw error;

    const events = Array.isArray(data)
      ? data.map(mapRowToEvent).filter((ev) => util.isValidEvent(ev))
      : [];

    saveEventsCache(events);

    return { ok: true, events };
  } catch (error) {
    console.warn("Error cargando eventos remotos. Uso cache offline.", error);

    const cachedEvents = loadEventsCache().map((ev) => util.normalizeEvent(ev))
      .filter((ev) => util.isValidEvent(ev));

    return {
      ok: cachedEvents.length > 0,
      error,
      events: cachedEvents
    };
  }
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

  function purgePastEvents(list = state.logic.events) {
  const today = util.todayStrYYYYMMDD();
  const safeList = Array.isArray(list) ? list : [];

  return safeList.filter((ev) => {
    if (!ev?.date) return false;
    if (ev.date >= today) return true;
    if (typeof util.isLateNightCarryoverEvent === "function" && util.isLateNightCarryoverEvent(ev)) {
      return true;
    }
    return false;
  });
}

  function hasPastEvents(list = state.logic.events) {
    const safeList = Array.isArray(list) ? list : [];
    const purged = purgePastEvents(safeList);
    return purged.length !== safeList.length;
  }

  async function insertEventCandidates(list = []) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const items = Array.isArray(list) ? list : [];
  if (!items.length) {
    return { ok: false, error: "EMPTY_CANDIDATES" };
  }

  const rows = items.map((c) => ({
  id: crypto.randomUUID(),
  source_name: c.source || "unknown",
  source_url: c.sourceUrl || "",
  external_id: c.sourceUrl
    ? `${c.source || "unknown"}::${c.sourceUrl}`
    : `${c.source || "unknown"}::${c.title || ""}::${c.date || ""}::${c.venueName || ""}`,

  raw_title: c.raw?.title || c.title || "",
  raw_date_text: c.raw?.dateText || c.date || "",
  raw_time_text: c.raw?.timeText || c.startTime || "",
  raw_place_text: c.raw?.placeText || c.venueName || "",
  raw_link: c.raw?.link || c.sourceUrl || "",

  parsed_title: c.title || "",
  parsed_date: c.date || null,
  parsed_start_time: c.startTime || null,
  parsed_place_name: c.venueName || "",
  parsed_category: c.category || "music",
  parsed_lat: Number.isFinite(c.lat) ? c.lat : null,
  parsed_lng: Number.isFinite(c.lng) ? c.lng : null,

  status: c.status || "pending",
  notes: ""
}));

  const { data, error } = await db
    .from("event_candidates")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("Error insertando event_candidates:", error);
    return { ok: false, error };
  }

  return {
    ok: true,
    count: Array.isArray(data) ? data.length : 0,
    candidates: Array.isArray(data) ? data : []
  };
}

async function loadVenuesRemote() {
  const supabase = App.supabase;
  if (!supabase) {
    const cachedVenues = loadVenuesCache();
    App.venues?.replaceAllVenues?.(cachedVenues);
    return {
      ok: cachedVenues.length > 0,
      error: "SUPABASE_NOT_READY",
      count: cachedVenues.length,
      venues: cachedVenues
    };
  }

  try {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    const venues = Array.isArray(data) ? data.map(mapRowToVenue) : [];

    saveVenuesCache(venues);
    App.venues?.replaceAllVenues?.(venues);

    return { ok: true, count: venues.length, venues };
  } catch (error) {
    console.warn("No se pudieron cargar los venues desde Supabase. Uso cache offline.", error);

    const cachedVenues = loadVenuesCache();
    App.venues?.replaceAllVenues?.(cachedVenues);

    return {
      ok: cachedVenues.length > 0,
      error,
      count: cachedVenues.length,
      venues: cachedVenues
    };
  }
}

async function insertVenue(venue) {
  const supabase = App.supabase;
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_READY" };

  const row = mapVenueToRow(venue);

  const { data, error } = await supabase
    .from("venues")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("No se pudo insertar el venue en Supabase.", error);
    return { ok: false, error };
  }

  return { ok: true, venue: mapRowToVenue(data) };
}

async function updateVenueRemote(venue) {
  const supabase = App.supabase;
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_READY" };

  const row = mapVenueToRow(venue);

  const { data, error } = await supabase
    .from("venues")
    .update(row)
    .eq("id", venue.id)
    .select()
    .single();

  if (error) {
    console.error("No se pudo actualizar el venue en Supabase.", error);
    return { ok: false, error };
  }

  return { ok: true, venue: mapRowToVenue(data) };
}

async function deleteVenueRemote(venueId) {
  const supabase = App.supabase;
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_READY" };

  const { error } = await supabase
    .from("venues")
    .delete()
    .eq("id", venueId);

  if (error) {
    console.error("No se pudo borrar el venue en Supabase.", error);
    return { ok: false, error };
  }

  return { ok: true };
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

    if (error) {
      console.error("Error borrando todos los eventos:", error);
      return { ok: false, error };
    }

    const deletedCount = Number(data);

    if (!Number.isFinite(deletedCount)) {
      return { ok: false, error: "INVALID_DELETE_ALL_RESPONSE" };
    }

    return {
      ok: true,
      deletedCount
    };
  }

  async function deletePastEvents() {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const today = util.todayStrYYYYMMDD();

  const { data, error } = await db
    .from("events")
    .delete()
    .lt("date", today)
    .select("id");

  if (error) {
    console.error("Error borrando eventos pasados:", error);
    return { ok: false, error };
  }

  return {
    ok: true,
    deletedCount: Array.isArray(data) ? data.length : 0
  };
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

  const row = {
    title: safe.title,
    place_name: safe.placeName || "",
    date: safe.date || null,
    start_time: safe.startTime || null,
    category: safe.category || "music",
    link: safe.link || "",
    lat: Number(safe.lat),
    lng: Number(safe.lng),

    series_id: safe.seriesId || null,
    recurrence_type: safe.recurrenceType || null,
    recurrence_interval: Number.isFinite(safe.recurrenceInterval)
      ? safe.recurrenceInterval
      : null,
    recurrence_until: safe.recurrenceUntil || null
  };

  const { data, error } = await db
    .from("events")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error actualizando evento:", error);
    return { ok: false, error };
  }

  if (!data) {
    return { ok: false, error: "UPDATE_FAILED" };
  }

  return { ok: true, event: mapRowToEvent(data) };
}

async function approveEventCandidatesBulk(candidateIds = []) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const ids = Array.isArray(candidateIds)
    ? candidateIds
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    : [];

  if (!ids.length) {
    return { ok: false, error: "EMPTY_CANDIDATE_IDS" };
  }

  const { data, error } = await db.rpc("approve_event_candidates_bulk", {
    p_ids: ids
  });

  if (error) {
    console.error("Error aprobando candidatos en lote:", error);
    return { ok: false, error };
  }

  return {
    ok: true,
    approvedCount: Number(data) || 0
  };
}

async function updateEventCandidateParsedData(candidateId, patch = {}) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const id = String(candidateId || "").trim();
  if (!id) {
    return { ok: false, error: "INVALID_CANDIDATE_ID" };
  }

  const updateRow = {};

  if ("parsed_lat" in patch) {
    updateRow.parsed_lat =
      patch.parsed_lat === null || patch.parsed_lat === undefined || patch.parsed_lat === ""
        ? null
        : Number(patch.parsed_lat);
  }

  if ("parsed_lng" in patch) {
    updateRow.parsed_lng =
      patch.parsed_lng === null || patch.parsed_lng === undefined || patch.parsed_lng === ""
        ? null
        : Number(patch.parsed_lng);
  }

  if ("parsed_place_name" in patch) {
    updateRow.parsed_place_name = String(patch.parsed_place_name || "").trim();
  }

  if (!Object.keys(updateRow).length) {
    return { ok: false, error: "EMPTY_PATCH" };
  }

  const { data, error } = await db
    .from("event_candidates")
    .update(updateRow)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error actualizando event_candidate:", error);
    return { ok: false, error };
  }

  return {
    ok: true,
    candidate: data
  };
}

async function loadPendingEventCandidatesBySource(sourceName = "") {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error, candidates: [] };
  }

  const source = String(sourceName || "").trim();
  if (!source) {
    return { ok: false, error: "MISSING_SOURCE_NAME", candidates: [] };
  }

  const { data, error } = await db
    .from("event_candidates")
    .select("*")
    .eq("source_name", source)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error cargando candidatos pendientes:", error);
    return { ok: false, error, candidates: [] };
  }

  return {
    ok: true,
    candidates: Array.isArray(data) ? data : []
  };
}

  function saveLoginState(value = state.logic.isLoggedIn) {
    localStorage.setItem(STORAGE_KEYS.LOGIN, JSON.stringify(!!value));
  }

  function readLoginState() {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGIN);
    const parsed = safeParseJSON(stored, false);
    return !!parsed;
  }

  async function deleteEventCandidate(candidateId) {
  const db = App.supabase;
  if (!db) {
    const error = new Error("App.supabase no está inicializado");
    console.error(error.message);
    return { ok: false, error };
  }

  const id = String(candidateId || "").trim();
  if (!id) {
    return { ok: false, error: "INVALID_CANDIDATE_ID" };
  }

  const { error } = await db
    .from("event_candidates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error borrando event_candidate:", error);
    return { ok: false, error };
  }

  return { ok: true, candidateId: id };
}

  App.storage = {
  loadEvents,
  readEvents,
  saveEvents,
  purgePastEvents,
  hasPastEvents,
  insertEvent,
  deleteEvent,
  deleteAllEvents,
  deletePastEvents,
  updateEvent,
  approveEventCandidatesBulk,
  loadPendingEventCandidatesBySource,
  insertEventCandidates,
  updateEventCandidateParsedData,
  saveLoginState,
  readLoginState,

  saveVenues,
  loadVenues,
    saveEventsCache,
  loadEventsCache,
  saveVenuesCache,
  loadVenuesCache,

  loadVenuesRemote,
  insertVenue,
  updateVenueRemote,
  deleteVenueRemote,
deleteEventCandidate,

  mapRowToEvent,
  mapEventToRow
};
})();