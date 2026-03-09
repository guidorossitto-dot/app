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

    return (m > 0 && m <= 60) || (m <= 0 && m >= -15);
  }

  function getPlaceBadge(events) {
    const cands = (events || [])
      .map((ev) => ({ ev, min: safeMinutesToStart(ev) }))
      .filter((x) => x.min !== null);

    if (cands.length === 0) return "";

    const soon = cands
      .filter((x) => x.min > 0 && x.min <= 60)
      .sort((a, b) => a.min - b.min)[0];

    if (soon) return `🔥 Empieza en ${soon.min} min`;

    const inProg = cands
      .filter((x) => x.min <= 0 && x.min >= -15)
      .sort((a, b) => Math.abs(a.min) - Math.abs(b.min))[0];

    if (inProg) return "🔴 En curso";

    return "";
  }

  function getFeaturedRank(ev) {
    const m = safeMinutesToStart(ev);
    if (m === null) return 999999;

    // primero los que ya empezaron hace hasta 15 min
    if (m <= 0 && m >= -15) return Math.abs(m);

    // después los que empiezan pronto
    if (m > 0 && m <= 60) return 100 + m;

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
  function getVisibleTodayEvents(list = state.events) {
    return util.filterByActiveCategory(util.getTodayEvents(list));
  }

  function getVisibleFutureEvents(list = state.events) {
    return util.filterByActiveCategory(util.getFutureEvents(list));
  }

  function getVisibleEventsOnDate(dateStr, list = state.events) {
    return util.filterByActiveCategory(util.getEventsOnDate(dateStr, list));
  }

  function getGroupedTodayEvents(list = state.events) {
    return getGroupedEvents(getVisibleTodayEvents(list));
  }

  function getGroupedFutureEvents(list = state.events) {
    return getGroupedEvents(getVisibleFutureEvents(list));
  }

  function getGroupedNearbyEvents(list = state.nearbyEvents) {
    return getGroupedEvents(list || []);
  }

  /* =========================
     FEATURED / NEARBY
  ========================= */
  function getTodayNearbyEvents(list = state.nearbyEvents) {
    const today = util.todayStrYYYYMMDD();
    return (list || []).filter((ev) => (ev?.date || "").slice(0, 10) === today);
  }

  function getFeaturedNearbyEvents(list = state.nearbyEvents) {
    const todayList = getTodayNearbyEvents(list);
    if (!todayList.length) return [];

    return [...todayList]
      .filter(isFeaturedEvent)
      .sort((a, b) => getFeaturedRank(a) - getFeaturedRank(b));
  }

  // compatibilidad temporal, por si otra parte de la app todavía espera uno solo
  function getFeaturedNearbyEvent(list = state.nearbyEvents) {
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

    getTodayNearbyEvents,
    getFeaturedNearbyEvents,
    getFeaturedNearbyEvent
  };
})();