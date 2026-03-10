// state-config.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  /* =========================
     CONFIG
  ========================= */
  App.CFG = {
    SEARCH_RADIUS_KM: 2,
    PIN_PRECISION: 4,
    DEFAULT_LAT: -34.6037,
    DEFAULT_LNG: -58.3816,
    REFRESH_MS: 60000,

    CATEGORY_ALL: "all",
    DEFAULT_CATEGORY: "music",
    ALLOWED_CATEGORIES: ["music", "dance", "theatre", "visual_arts"]
  };

  /* =========================
     APP STATE
     - logic: app/domain/ui logical state
     - runtime: map refs / ephemeral runtime
     - compatibility aliases kept for gradual migration
  ========================= */
  const logic = {
    isLoggedIn: false,
    events: [],
    calendarCursor: new Date(),
    activeCategory: App.CFG.CATEGORY_ALL,
    editingEventId: null,
    nearbyCenter: null, // { lat, lng } | null
    nearbyEvents: []
  };

  const runtime = {
    map: null,
    userMarker: null,
    eventCreationMarker: null,
    markerCluster: null,
    deepLinkLayer: null,
    locationMarkers: {},
    eventMarkers: [],

    pendingOpenEventId: null,
    pendingDeepLinkEventId: null,
    bootReady: false,
    uiPanZoomInProgress: false
  };

  const state = {
    logic,
    runtime
  };

  /* =========================
     COMPATIBILITY ALIASES
     Keep old state.foo access working while
     we migrate files gradually.
  ========================= */
  Object.defineProperties(state, {
    isLoggedIn: {
      get() { return logic.isLoggedIn; },
      set(v) { logic.isLoggedIn = !!v; },
      enumerable: true
    },
    events: {
      get() { return logic.events; },
      set(v) { logic.events = Array.isArray(v) ? v : []; },
      enumerable: true
    },
    calendarCursor: {
      get() { return logic.calendarCursor; },
      set(v) { logic.calendarCursor = v instanceof Date ? v : new Date(); },
      enumerable: true
    },
    activeCategory: {
      get() { return logic.activeCategory; },
      set(v) { logic.activeCategory = v; },
      enumerable: true
    },
    editingEventId: {
      get() { return logic.editingEventId; },
      set(v) { logic.editingEventId = v ? String(v).trim() : null; },
      enumerable: true
    },
    nearbyCenter: {
      get() { return logic.nearbyCenter; },
      set(v) { logic.nearbyCenter = v; },
      enumerable: true
    },
    nearbyEvents: {
      get() { return logic.nearbyEvents; },
      set(v) { logic.nearbyEvents = Array.isArray(v) ? v : []; },
      enumerable: true
    },

    map: {
      get() { return runtime.map; },
      set(v) { runtime.map = v; },
      enumerable: true
    },
    userMarker: {
      get() { return runtime.userMarker; },
      set(v) { runtime.userMarker = v; },
      enumerable: true
    },
    eventCreationMarker: {
      get() { return runtime.eventCreationMarker; },
      set(v) { runtime.eventCreationMarker = v; },
      enumerable: true
    },
    markerCluster: {
      get() { return runtime.markerCluster; },
      set(v) { runtime.markerCluster = v; },
      enumerable: true
    },
    deepLinkLayer: {
      get() { return runtime.deepLinkLayer; },
      set(v) { runtime.deepLinkLayer = v; },
      enumerable: true
    },
    locationMarkers: {
      get() { return runtime.locationMarkers; },
      set(v) { runtime.locationMarkers = v || {}; },
      enumerable: true
    },
    eventMarkers: {
      get() { return runtime.eventMarkers; },
      set(v) { runtime.eventMarkers = Array.isArray(v) ? v : []; },
      enumerable: true
    },

    _pendingOpenEventId: {
      get() { return runtime.pendingOpenEventId; },
      set(v) { runtime.pendingOpenEventId = v ? String(v).trim() : null; },
      enumerable: true
    },
    _pendingDeepLinkEventId: {
      get() { return runtime.pendingDeepLinkEventId; },
      set(v) { runtime.pendingDeepLinkEventId = v ? String(v).trim() : null; },
      enumerable: true
    },
    _bootReady: {
      get() { return runtime.bootReady; },
      set(v) { runtime.bootReady = !!v; },
      enumerable: true
    },
    _uiPanZoomInProgress: {
      get() { return runtime.uiPanZoomInProgress; },
      set(v) { runtime.uiPanZoomInProgress = !!v; },
      enumerable: true
    }
  });

  App.state = state;

  /* =========================
     BASIC HELPERS
  ========================= */
  function newId() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return `${Date.now()}_${Math.random()}`;
  }

  function isValidCoord(n) {
    return typeof n === "number" && !Number.isNaN(n) && Number.isFinite(n);
  }

  function shortPlaceName(full) {
    const s = (full || "").toString().trim();
    if (!s) return "";
    return s.split(",")[0].trim();
  }

  function locationKey(lat, lng) {
    return `${Number(lat).toFixed(App.CFG.PIN_PRECISION)},${Number(lng).toFixed(
      App.CFG.PIN_PRECISION
    )}`;
  }

  function normalizePlaceText(s) {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /* =========================
     DATE / TIME HELPERS
  ========================= */
  function formatDateParts(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { y, m, d };
  }

  function todayStrYYYYMMDD() {
    const t = new Date();
    const { y, m, d } = formatDateParts(t);
    return `${y}-${m}-${d}`;
  }

  function addDaysYYYYMMDD(dateStr, days) {
    const [y, m, d] = (dateStr || "").split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + Number(days || 0));

    const parts = formatDateParts(dt);
    return `${parts.y}-${parts.m}-${parts.d}`;
  }

  function makeLocalDateTime(dateStr, timeStr) {
    const [y, m, d] = (dateStr || "").split("-").map(Number);
    const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
    return new Date(y || 0, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }

  function formatTimeStart(ev) {
    const s = (ev?.startTime || "").toString().trim();
    return s || "";
  }

  function minutesToStart(ev) {
    if (!ev?.date) return null;

    const st = (ev.startTime || "").toString().trim();
    if (!st) return null;

    const eventDate = makeLocalDateTime(ev.date, st);
    const diff = eventDate.getTime() - Date.now();
    return Math.round(diff / 60000);
  }

  /* =========================
     EVENT STATUS / SORT
  ========================= */
  function getEventStatus(ev) {
    if (!ev || !ev.date) return "";

    const today = todayStrYYYYMMDD();
    const tomorrow = addDaysYYYYMMDD(today, 1);

    if (ev.date === tomorrow) {
      const st = (ev.startTime || "").trim();
      return st ? `Mañana ${st}` : "Mañana";
    }

    if (ev.date > today) {
      const diffDays = Math.round(
        (makeLocalDateTime(ev.date, "00:00") - makeLocalDateTime(today, "00:00")) / 86400000
      );
      return `En ${diffDays} días`;
    }

    const st = (ev.startTime || "").trim();
    if (!st) return "Hoy";

    const now = new Date();
    const eventDT = makeLocalDateTime(ev.date, st);
    const diffMs = eventDT - now;

    if (diffMs <= 0) return "En curso";

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `Comienza en ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 6) return `Comienza en ${hours} h`;

    return "Hoy";
  }

  function sortEventsByStatusThenTime(a, b) {
    const sa = getEventStatus(a);
    const sb = getEventStatus(b);

    const rank = (s) => {
      if (!s) return 3;
      if (s.startsWith("En curso")) return 0;
      if (s.startsWith("Comienza en")) return 1;
      if (s === "Hoy") return 2;
      return 3;
    };

    const ra = rank(sa);
    const rb = rank(sb);
    if (ra !== rb) return ra - rb;

    const ta = a?.startTime || "99:99";
    const tb = b?.startTime || "99:99";
    const c = ta.localeCompare(tb);
    if (c !== 0) return c;

    return (a?.title || "").localeCompare(b?.title || "");
  }

  /* =========================
     GEO / DISTANCE
  ========================= */
  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* =========================
     CATEGORY
  ========================= */
  function normalizeCategory(raw) {
    const v = (raw ?? "").toString().trim();
    return App.CFG.ALLOWED_CATEGORIES.includes(v) ? v : App.CFG.DEFAULT_CATEGORY;
  }

  function categoryLabel(cat) {
    switch (cat) {
      case "music":
        return "🎵 Música";
      case "dance":
        return "💃 Danza";
      case "theatre":
        return "🎭 Teatro";
      case "visual_arts":
        return "🖼️ Visuales";
      default:
        return "";
    }
  }

  /* =========================
     EVENT MODEL
  ========================= */
  function normalizeEvent(raw) {
    const lat = Number(raw?.lat);
    const lng = Number(raw?.lng);

    return {
      id: (raw?.id ?? newId()).toString().trim(),
      title: (raw?.title ?? "").toString().trim(),
      date: (raw?.date ?? "").toString().trim(),
      lat,
      lng,
      placeName: (raw?.placeName ?? "").toString().trim(),
      startTime: (raw?.startTime ?? "").toString().trim(),
      category: normalizeCategory(raw?.category)
    };
  }

  function isValidEvent(ev) {
    return !!(
      ev &&
      typeof ev.id === "string" &&
      ev.id.trim() &&
      typeof ev.title === "string" &&
      ev.title.trim() &&
      typeof ev.date === "string" &&
      ev.date.trim() &&
      isValidCoord(ev.lat) &&
      isValidCoord(ev.lng)
    );
  }

  /* =========================
     COLLECTION HELPERS / SELECTORS
  ========================= */
  function getAllEvents(list = App.state.events) {
    return Array.isArray(list) ? list : [];
  }

  function filterByActiveCategory(list = getAllEvents()) {
    const cat = App.state.activeCategory;
    if (!cat || cat === App.CFG.CATEGORY_ALL) return list;
    return getAllEvents(list).filter((ev) => ev?.category === cat);
  }

  function getTodayEvents(list = getAllEvents()) {
    const today = todayStrYYYYMMDD();
    return getAllEvents(list).filter((ev) => ev?.date === today);
  }

  function getFutureEvents(list = getAllEvents()) {
    const today = todayStrYYYYMMDD();
    return getAllEvents(list).filter((ev) => ev?.date && ev.date > today);
  }

  function getEventsOnDate(dateStr, list = getAllEvents()) {
    return getAllEvents(list).filter((ev) => (ev?.date || "").slice(0, 10) === dateStr);
  }

  function getNearbyTodayEvents(lat, lng, list = getAllEvents()) {
    const base = filterByActiveCategory(getTodayEvents(list));

    return base.filter((ev) => {
      if (!isValidCoord(ev?.lat) || !isValidCoord(ev?.lng)) return false;
      return distanceKm(lat, lng, ev.lat, ev.lng) <= App.CFG.SEARCH_RADIUS_KM;
    });
  }

  /* =========================
     PLACE GROUPING / KEYS
  ========================= */
  function findPlaceAnchor(ev, list = App.state.events) {
    if (!ev) return null;
    if (!isValidCoord(ev.lat) || !isValidCoord(ev.lng)) return null;

    const targetName = normalizePlaceText(shortPlaceName(ev.placeName));
    const all = Array.isArray(list) ? list : [];

    let best = null;

    for (const other of all) {
      if (!other) continue;
      if (!isValidCoord(other.lat) || !isValidCoord(other.lng)) continue;

      const otherName = normalizePlaceText(shortPlaceName(other.placeName));
      const dist = distanceKm(ev.lat, ev.lng, other.lat, other.lng);

      const sameShortName = !!targetName && !!otherName && targetName === otherName;
      const nearAndSameName = sameShortName && dist <= 0.12;

      if (!nearAndSameName) continue;

      if (!best || dist < best.dist) {
        best = {
          lat: other.lat,
          lng: other.lng,
          placeName: other.placeName || ev.placeName,
          dist
        };
      }
    }

    return best;
  }

  function smartLocationKey(ev, list = App.state.events) {
    if (!ev) return "";
    if (!isValidCoord(ev.lat) || !isValidCoord(ev.lng)) return "";

    const anchor = findPlaceAnchor(ev, list);
    if (anchor) return locationKey(anchor.lat, anchor.lng);

    return locationKey(ev.lat, ev.lng);
  }

  /* =========================
     EXPORTS
  ========================= */
  App.util = {
    newId,
    isValidCoord,
    shortPlaceName,
    locationKey,
    normalizePlaceText,

    todayStrYYYYMMDD,
    addDaysYYYYMMDD,
    makeLocalDateTime,
    formatDateDisplay,
    formatTimeStart,
    minutesToStart,

    getEventStatus,
    sortEventsByStatusThenTime,

    normalizeCategory,
    categoryLabel,

    normalizeEvent,
    isValidEvent,

    getAllEvents,
    filterByActiveCategory,
    getTodayEvents,
    getFutureEvents,
    getEventsOnDate,
    getNearbyTodayEvents,

    findPlaceAnchor,
    smartLocationKey,

    distanceKm
  };
})();