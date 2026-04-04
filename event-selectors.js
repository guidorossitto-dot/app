// event-selectors.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;

  /* =========================
     BASIC HELPERS
  ========================= */
  function safeMinutesToStart(ev) {
    const m = util.minutesToStart(ev);
    return Number.isFinite(m) ? m : null;
  }

function isFeaturedEvent(ev) {
  const m = safeMinutesToStart(ev);
  if (m === null) return false;

  const soonMin = Number(App.CFG?.FEATURED_SOON_MIN ?? 90);
  const recentMin = Number(App.CFG?.FEATURED_RECENT_MIN ?? 15);

  return (m > 0 && m <= soonMin) || (m <= 0 && m >= -recentMin);
}

function getPlaceBadge(events) {
  const cands = (events || [])
    .map((ev) => ({ ev, min: safeMinutesToStart(ev) }))
    .filter((x) => x.min !== null);

  if (cands.length === 0) return "";

  const soonMin = Number(App.CFG?.FEATURED_SOON_MIN ?? 90);
  const recentMin = Number(App.CFG?.FEATURED_RECENT_MIN ?? 15);

  const soon = cands
    .filter((x) => x.min > 0 && x.min <= soonMin)
    .sort((a, b) => a.min - b.min)[0];

  if (soon) return `🔥 Empieza en ${soon.min} min`;

  const inProg = cands
    .filter((x) => x.min <= 0 && x.min >= -recentMin)
    .sort((a, b) => Math.abs(a.min) - Math.abs(b.min))[0];

  if (inProg) return "🔴 En curso";

  return "";
}

function getFeaturedRank(ev) {
  const m = safeMinutesToStart(ev);
  if (m === null) return 999999;

  const soonMin = Number(App.CFG?.FEATURED_SOON_MIN ?? 90);
  const recentMin = Number(App.CFG?.FEATURED_RECENT_MIN ?? 15);

  if (m <= 0 && m >= -recentMin) return Math.abs(m);
  if (m > 0 && m <= soonMin) return 100 + m;

  return 999999;
}

  /* =========================
     GROUPING
  ========================= */
  function groupEventsByPlace(list = []) {
    const groups = new Map();

    for (const ev of list || []) {
      if (!ev) continue;

      const key = util.smartLocationKey(ev, list);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          placeName: (ev.placeName || "").trim(),
          lat: ev.lat,
          lng: ev.lng,
          events: []
        });
      }

      groups.get(key).events.push(ev);
    }

    return [...groups.values()];
  }

  function sortGroupedEventsByPriority(groups = []) {
    return [...groups].sort((ga, gb) => {
      const aBadge = getPlaceBadge(ga.events);
      const bBadge = getPlaceBadge(gb.events);

      if (!!aBadge !== !!bBadge) return aBadge ? -1 : 1;

      const aMin = Math.min(
        ...ga.events.map((e) => {
          const m = safeMinutesToStart(e);
          if (m === null) return 999999;
          if ((m > 0 && m <= 60) || (m <= 0 && m >= -15)) return getFeaturedRank(e);
          return 100000 + Math.abs(m);
        })
      );

      const bMin = Math.min(
        ...gb.events.map((e) => {
          const m = safeMinutesToStart(e);
          if (m === null) return 999999;
          if ((m > 0 && m <= 60) || (m <= 0 && m >= -15)) return getFeaturedRank(e);
          return 100000 + Math.abs(m);
        })
      );

      return aMin - bMin;
    });
  }

  function getGroupedEvents(list = []) {
    const groups = groupEventsByPlace(list);

    return sortGroupedEventsByPriority(groups).map((g) => {
      const sortedEvents = [...g.events].sort(util.sortEventsByStatusThenTime);

      return {
        ...g,
        placeTitle: util.shortPlaceName(g.placeName) || "Lugar sin nombre",
        count: sortedEvents.length,
        badge: getPlaceBadge(sortedEvents),
        events: sortedEvents
      };
    });
  }

  /* =========================
     FILTERED VIEWS
  ========================= */
  function getVisibleTodayEvents(list = state.logic.events) {
    return util.filterByActiveCategory(util.getTodayEvents(list));
  }

  function getVisibleFutureEvents(list = state.logic.events) {
    return util.filterByActiveCategory(util.getFutureEvents(list));
  }

  function getVisibleEventsOnDate(dateStr, list = state.logic.events) {
    return util.filterByActiveCategory(util.getEventsOnDate(dateStr, list));
  }

  function isMapPersistentCategory(category) {
  const cat = util.normalizeCategory(category);
  return cat === "visual_arts" || cat === "games";
}

function isMapTimedCategory(category) {
  const cat = util.normalizeCategory(category);
  return cat === "music" || cat === "dance" || cat === "theatre" || cat === "cinema";
}

function isEventVisibleOnMap(ev, now = new Date()) {
  if (!ev?.date) return false;

  const today = util.todayStrYYYYMMDD();
  const evDate = String(ev.date || "").slice(0, 10);

  if (evDate > today) return false;

  const isTodayLike =
    evDate === today ||
    (typeof util.isLateNightCarryoverEvent === "function" && util.isLateNightCarryoverEvent(ev));

  if (!isTodayLike) return false;

  const cat = util.normalizeCategory(ev.category);

  if (cat === "games") {
    return true;
  }

  const startTime = String(ev.startTime || "").trim();
  if (!startTime) return true;

  const start = util.makeLocalDateTime(ev.date, startTime);
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return true;

  const diffHours = (now.getTime() - start.getTime()) / 3600000;

  if (cat === "visual_arts") {
    return diffHours <= 8;
  }

  if (cat === "music") {
    return diffHours <= 3;
  }

  if (cat === "theatre" || cat === "cinema" || cat === "dance") {
    return diffHours <= 1;
  }

  return true;
}

function getMapVisibleEvents(list = state.logic.events) {
  const base = util.filterByActiveCategory(Array.isArray(list) ? list : []);
  return base.filter((ev) => isEventVisibleOnMap(ev));
}

  function getGroupedTodayEvents(list = state.logic.events) {
    return getGroupedEvents(getVisibleTodayEvents(list));
  }

  function getGroupedFutureEvents(list = state.logic.events) {
    return getGroupedEvents(getVisibleFutureEvents(list));
  }

  function getGroupedNearbyEvents(list = state.logic.nearbyEvents) {
    return getGroupedEvents(list || []);
  }

  /* =========================
     FEATURED / NEARBY
  ========================= */
  function getTodayNearbyEvents(list = state.logic.nearbyEvents) {
  return util.getTodayEvents(list || []);
}

  function getFeaturedNearbyEvents(list = state.logic.nearbyEvents) {
    const todayList = getTodayNearbyEvents(list);
    if (!todayList.length) return [];

    return [...todayList]
      .filter(isFeaturedEvent)
      .sort((a, b) => getFeaturedRank(a) - getFeaturedRank(b));
  }

  function getFeaturedNearbyEvent(list = state.logic.nearbyEvents) {
    return getFeaturedNearbyEvents(list)[0] || null;
  }

  /* =========================
     EXPORT
  ========================= */
  App.selectors = {
    safeMinutesToStart,
    isFeaturedEvent,
    getPlaceBadge,
    getFeaturedRank,

    groupEventsByPlace,
    sortGroupedEventsByPriority,
    getGroupedEvents,

    getVisibleTodayEvents,
    getVisibleFutureEvents,
    getVisibleEventsOnDate,

    getGroupedTodayEvents,
    getGroupedFutureEvents,
    getGroupedNearbyEvents,

    isMapPersistentCategory,
isMapTimedCategory,
isEventVisibleOnMap,
getMapVisibleEvents,

    getTodayNearbyEvents,
    getFeaturedNearbyEvents,
    getFeaturedNearbyEvent
  };
})();