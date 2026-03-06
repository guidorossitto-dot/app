// state-config.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  App.CFG = {
    SEARCH_RADIUS_KM: 2,
    PIN_PRECISION: 4,
    DEFAULT_LAT: -34.6037,
    DEFAULT_LNG: -58.3816,
    REFRESH_MS: 60000
  };

  App.state = {
    isLoggedIn: false,
    events: [],

    map: null,
    userMarker: null,
    eventCreationMarker: null,

    markerCluster: null,
    deepLinkLayer: null,

    locationMarkers: {},
    eventMarkers: [],

    calendarCursor: new Date(),
    activeCategory: "all",

    nearbyCenter: null, // { lat, lng } | null
    nearbyEvents: [],

    _pendingOpenEventId: null,
    _pendingDeepLinkEventId: null,
    _bootReady: false,
    _uiPanZoomInProgress: false
  };

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
    return `${Number(lat).toFixed(App.CFG.PIN_PRECISION)},${Number(lng).toFixed(App.CFG.PIN_PRECISION)}`;
  }

  function todayStrYYYYMMDD() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  function addDaysYYYYMMDD(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function makeLocalDateTime(dateStr, timeStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }

  function formatTimeStart(ev) {
    const s = (ev?.startTime || "").toString().trim();
    return s ? s : "";
  }

  function minutesToStart(ev) {
    if (!ev?.date) return null;

    const st = (ev.startTime || "").toString().trim();
    if (!st) return null;

    const [y, mo, d] = ev.date.split("-").map(Number);
    const [hh, mm] = st.split(":").map(Number);

    const eventDate = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
    const diff = eventDate.getTime() - Date.now();
    return Math.round(diff / 60000);
  }

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

  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function normalizeCategory(raw) {
    const v = (raw ?? "").toString().trim();
    const allowed = new Set(["music", "dance", "theatre", "visual_arts"]);
    return allowed.has(v) ? v : "music";
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

  function getAllEvents(list = App.state.events) {
    return Array.isArray(list) ? list : [];
  }

  function filterByActiveCategory(list = getAllEvents()) {
    const cat = App.state.activeCategory;
    if (!cat || cat === "all") return list;
    return list.filter((ev) => ev?.category === cat);
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

  App.util = {
    newId,
    isValidCoord,
    shortPlaceName,
    locationKey,

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

    distanceKm
  };
})();