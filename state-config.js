// state-config.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  /* =========================
     CONFIG
  ========================= */
  App.CFG = {
  SEARCH_RADIUS_KM: 5,
  PIN_PRECISION: 4, 
  DEFAULT_LAT: -34.6037,
  DEFAULT_LNG: -58.3816,
  REFRESH_MS: 60000,
  NIGHT_ROLLOVER_START_HOUR: 23,
  NIGHT_ROLLOVER_END_HOUR: 4,

  FEATURED_SOON_MIN: 90,
  FEATURED_RECENT_MIN: 15,

  CATEGORY_ALL: "all",
  DEFAULT_CATEGORY: "music",

  CATEGORIES: {
    music: {
      label: "Música",
      emoji: "🎵"
    },
    dance: {
      label: "Danza",
      emoji: "💃"
    },
    theatre: {
      label: "Teatro",
      emoji: "🎭"
    },
    visual_arts: {
      label: "Visuales",
      emoji: "🖼️"
    },
    cinema: {
      label: "Cine",
      emoji: "🎬"
    },

    literature: {
      label: "Literatura",
      emoji: "📚"
    },
    gastronomy: {
      label: "Gastronomía",
      emoji: "🍷"
    },
    games: {
      label: "Juegos",
      emoji: "🎯"
    }
  }
};

App.CFG.ALLOWED_CATEGORIES = Object.keys(App.CFG.CATEGORIES);

  /* =========================
     APP STATE
     - logic: app/domain/ui logical state
     - runtime: map refs / ephemeral runtime
  ========================= */
  App.state = {
    logic: {
  isLoggedIn: false,
  events: [],
  venues: [],
  calendarCursor: new Date(),
  favorites: [],
  favoritesOnly: false,
  activeCategory: App.CFG.CATEGORY_ALL,
  editingEventId: null,
  editingMode: null,
  editingSeriesId: null,
  

  adminVenueQuery: "",
  adminVenueSuggestions: [],
  selectedVenueId: null,
  nearbyCenter: null,
    candidates: [],
  candidateSelection: [],
  nearbyEvents: [],

  discovery: {
    mode: "smart",
    resultEventId: null,
    excludedEventIds: [],
    lastGeneratedAt: null
  }
},

    runtime: {
  map: null,
  userMarker: null,
  eventCreationMarker: null,
  markerCluster: null,
  deepLinkLayer: null,
  locationMarkers: {},
  eventMarkers: [],
  temporaryFocusMarker: null,
  pendingCalendarDate: null,

activePopupLocationKey: null,
activePopupEventId: null,
activePopupLatLng: null,
activePopupWantsPreserve: false,
skipPopupIntentClearCount: 0,
lastZoomBeforeChange: null,
pendingMapClickTimer: null,

  pendingOpenEventId: null,
  pendingDeepLinkEventId: null,
  bootReady: false,
  uiPanZoomInProgress: false,

  // 👇 NUEVO
    bindings: {
    loginUI: false,
    discoveryUI: false
  }
}
  };

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
  if (!s) return "";

  return s.slice(0, 5);
}
  function minutesToStart(ev) {
    if (!ev?.date) return null;

    const st = (ev.startTime || "").toString().trim();
    if (!st) return null;

    const eventDate = makeLocalDateTime(ev.date, st);
    const diff = eventDate.getTime() - Date.now();
    return Math.round(diff / 60000);
  }

  function isLateNightCarryoverEvent(ev) {
  if (!ev?.date || !ev?.startTime) return false;

  const now = new Date();
  const currentHour = now.getHours();

  // solo aplica durante la madrugada
  if (currentHour >= App.CFG.NIGHT_ROLLOVER_END_HOUR) return false;

  const yesterday = addDaysYYYYMMDD(todayStrYYYYMMDD(), -1);
  if (ev.date !== yesterday) return false;

  const [hh] = String(ev.startTime || "00:00").split(":").map(Number);
  if (!Number.isFinite(hh)) return false;

  return hh >= App.CFG.NIGHT_ROLLOVER_START_HOUR;
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

  if (diffMs <= 0) {
    const minutesAgo = Math.abs(Math.floor(diffMs / 60000));

    if (minutesAgo < 60) return `Comenzó hace ${minutesAgo} min`;

    const hoursAgo = Math.floor(minutesAgo / 60);
    const remAgo = minutesAgo % 60;

    return remAgo > 0
      ? `Comenzó hace ${hoursAgo} h ${remAgo} min`
      : `Comenzó hace ${hoursAgo} h`;
  }

  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 60) return `Comienza en ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;

  if (hours < 6) {
    return rem > 0
      ? `Comienza en ${hours} h ${rem} min`
      : `Comienza en ${hours} h`;
  }

  return "Hoy";
}

  function sortEventsByStatusThenTime(a, b) {
  const sa = getEventStatus(a);
  const sb = getEventStatus(b);

  const rank = (s) => {
    if (!s) return 3;
    if (s.startsWith("Comenzó hace")) return 0;
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

function categoryEmoji(cat) {
  const key = normalizeCategory(cat);
  return App.CFG.CATEGORIES[key]?.emoji || "";
}

function categoryName(cat) {
  const key = normalizeCategory(cat);
  return App.CFG.CATEGORIES[key]?.label || "";
}

function categoryLabel(cat) {
  const emoji = categoryEmoji(cat);
  const name = categoryName(cat);
  return emoji && name ? `${emoji} ${name}` : "";
}

  /* =========================
     EVENT MODEL
  ========================= */
 function normalizeEvent(raw) {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);

  const recurrenceIntervalRaw = Number(raw?.recurrenceInterval);
  const recurrenceInterval = Number.isFinite(recurrenceIntervalRaw)
    ? recurrenceIntervalRaw
    : null;

  return {
    id: (raw?.id ?? newId()).toString().trim(),
    title: (raw?.title ?? "").toString().trim(),
    date: (raw?.date ?? "").toString().trim(),
    lat,
    lng,
    placeName: (raw?.placeName ?? "").toString().trim(),
    startTime: (raw?.startTime ?? "").toString().trim(),
    category: normalizeCategory(raw?.category),
    link: (raw?.link ?? "").toString().trim(),
    flyerUrl: (raw?.flyerUrl ?? raw?.flyer_url ?? "").toString().trim(),

    seriesId: (raw?.seriesId ?? "").toString().trim(),
    recurrenceType: (raw?.recurrenceType ?? "").toString().trim(),
    recurrenceInterval,
    recurrenceUntil: (raw?.recurrenceUntil ?? "").toString().trim()
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
  function getAllEvents(list = App.state.logic.events) {
    return Array.isArray(list) ? list : [];
  }

 function filterByActiveCategory(list = []) {
  const safe = Array.isArray(list) ? list : [];
  const activeCategory = App.state?.logic?.activeCategory || "all";
  const favoritesOnly = !!App.state?.logic?.favoritesOnly;
  const favorites = Array.isArray(App.state?.logic?.favorites)
    ? App.state.logic.favorites.map((id) => String(id || "").trim())
    : [];

  let result = activeCategory === "all"
    ? safe
    : safe.filter((ev) => ev?.category === activeCategory);

  if (favoritesOnly) {
    result = result.filter((ev) => favorites.includes(String(ev?.id || "").trim()));
  }

  return result;
}

function getTodayEvents(list = getAllEvents()) {
  const today = todayStrYYYYMMDD();

  return getAllEvents(list).filter((ev) => {
    return ev?.date === today || isLateNightCarryoverEvent(ev);
  });
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
  function findPlaceAnchor(ev, list = App.state.logic.events) {
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

  function smartLocationKey(ev, list = App.state.logic.events) {
    if (!ev) return "";
    if (!isValidCoord(ev.lat) || !isValidCoord(ev.lng)) return "";

    const anchor = findPlaceAnchor(ev, list);
    if (anchor) return locationKey(anchor.lat, anchor.lng);

    return locationKey(ev.lat, ev.lng);
  }

  function isAdminMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("admin") === "1";
  }

   function canManageUI() {
  return !!App.state.logic.isLoggedIn && isAdminMode();
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
    isAdminMode,
    canManageUI,

    todayStrYYYYMMDD,
    addDaysYYYYMMDD,
    makeLocalDateTime,
    formatDateDisplay,
    formatTimeStart,
    minutesToStart,

    getEventStatus,
    sortEventsByStatusThenTime,

    normalizeCategory,
    categoryEmoji,
    categoryName,
    categoryLabel,

    normalizeEvent,
    isValidEvent,

    getAllEvents,
    filterByActiveCategory,
    getTodayEvents,
    getFutureEvents,
    getEventsOnDate,
    getNearbyTodayEvents,
    isLateNightCarryoverEvent,

    findPlaceAnchor,
    smartLocationKey,

    distanceKm
  };
})();