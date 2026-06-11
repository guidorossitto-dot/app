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

  function getPricingConfig(type) {
  const safeType = App.util?.normalizePricingType
    ? App.util.normalizePricingType(type)
    : String(type || "unknown").trim();

  return App.CFG?.PRICING_TYPES?.[safeType] || App.CFG?.PRICING_TYPES?.unknown || {
    label: "No informado",
    emoji: "🎫"
  };
}

  function getEventPricingType(ev) {
    const raw = ev?.pricingType ?? ev?.pricing_type ?? "unknown";

    return App.util?.normalizePricingType
      ? App.util.normalizePricingType(raw)
      : String(raw || "unknown").trim();
  }

  function getEventPriceNote(ev) {
    return String(ev?.priceNote ?? ev?.price_note ?? "").trim();
  }

  function getPricingLabel(ev) {
    const type = getEventPricingType(ev);
    const note = getEventPriceNote(ev);

    if (note) return note;
    if (type === "unknown") return "";

    return getPricingConfig(type).label || "";
  }

  function getPricingBadge(ev) {
    const label = getPricingLabel(ev);
    if (!label) return "";

    const type = getEventPricingType(ev);
    const cfg = getPricingConfig(type);

    return `${cfg.emoji || "🎫"} ${label}`;
  }

  function isFreeEvent(ev) {
    return getEventPricingType(ev) === "free";
  }

  function normalizePartnerText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

  function getPartnerConfigs() {
  const configured = Array.isArray(App.CFG?.PARTNER_VENUES)
    ? App.CFG.PARTNER_VENUES
    : [];

  // fallback seguro por si todavía no agregaste PARTNER_VENUES en state-config.js
  return configured.length
    ? configured
    : [
        {
          match: "la carbonera",
          label: "Colaboradores",
          icon: "⭐",
          priority: 1
        }
      ];
}

  function getEventPartner(ev) {
  if (!ev) return null;

  const place = normalizePartnerText(
    ev.placeName ||
    ev.place_name ||
    ev.raw_place_text ||
    ""
  );

  const configs = getPartnerConfigs();

  const found = configs.find((cfg) => {
    const match = normalizePartnerText(cfg.match || cfg.name || "");
    return match && place.includes(match);
  });

  if (!found) return null;

  return {
    label: found.label || "Colaboradores",
    icon: found.icon || "⭐",
    priority: Number.isFinite(Number(found.priority))
      ? Number(found.priority)
      : 999
  };
}

function isPartnerEvent(ev) {
  return !!getEventPartner(ev);
}

function getPartnerPriority(ev) {
  const partner = getEventPartner(ev);
  return partner ? partner.priority : 999999;
}

function comparePartnerEventsFirst(a, b) {
  const pa = getPartnerPriority(a);
  const pb = getPartnerPriority(b);

  if (pa !== pb) return pa - pb;

  return 0;
}

function sortPartnerEventsFirst(list = [], fallbackCompare = util.sortEventsByStatusThenTime) {
  const safe = Array.isArray(list) ? [...list] : [];

  return safe.sort((a, b) => {
    const byPartner = comparePartnerEventsFirst(a, b);
    if (byPartner !== 0) return byPartner;

    if (typeof fallbackCompare === "function") {
      return fallbackCompare(a, b);
    }

    const timeA = String(a?.startTime || "99:99").slice(0, 5);
    const timeB = String(b?.startTime || "99:99").slice(0, 5);
    const byTime = timeA.localeCompare(timeB);
    if (byTime !== 0) return byTime;

    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

 function passesDiscoveryLeadTime(ev) {
  const mins = safeMinutesToStart(ev);
  const nearbyCenter = state.logic.nearbyCenter;

  // Si no hay hora, no lo bloqueamos
  if (mins === null) return true;

  // Excepción: si está muy cerca (< 500 m), no exigimos lead time
  if (
    nearbyCenter &&
    util.isValidCoord(ev?.lat) &&
    util.isValidCoord(ev?.lng)
  ) {
    const dist = util.distanceKm(
      nearbyCenter.lat,
      nearbyCenter.lng,
      Number(ev.lat),
      Number(ev.lng)
    );

    if (dist < 0.5) {
      return true;
    }
  }

  // Resto: tiene que empezar en 15 min o más
  return mins >= 15;
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

  if (inProg) return `🔴 Comenzó hace ${Math.abs(inProg.min)} min`;

  return "";
}

function getFeaturedRank(ev) {
  const m = safeMinutesToStart(ev);
  if (m === null) return 999999;

  const soonMin = Number(App.CFG?.FEATURED_SOON_MIN ?? 90);
  const recentMin = Number(App.CFG?.FEATURED_RECENT_MIN ?? 15);

  // primero lo que está por empezar
  if (m > 0 && m <= soonMin) return m;

  // después lo que recién empezó
  if (m <= 0 && m >= -recentMin) return 100 + Math.abs(m);

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
      const aPartner = Math.min(...ga.events.map(getPartnerPriority));
      const bPartner = Math.min(...gb.events.map(getPartnerPriority));
      
      if (aPartner !== bPartner) return aPartner - bPartner;
      
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
      const sortedEvents = sortPartnerEventsFirst(g.events);

      return {
        ...g,
        placeTitle: util.shortPlaceName(g.placeName) || "Lugar sin nombre",
        count: sortedEvents.length,
        badge: getPlaceBadge(sortedEvents),
        events: sortedEvents
      };
    });
  }

  function isStillRelevantForTodayAccordion(ev) {
  if (!ev || !ev.date) return false;

  const today = util.todayStrYYYYMMDD();
  const displayDate = util.getEventDisplayDate
    ? util.getEventDisplayDate(ev)
    : String(ev.date || "").slice(0, 10);

  if (displayDate !== today) return false;

  const mins = safeMinutesToStart(ev);

  if (mins === null) return true;
  if (mins >= 0) return true;

  const startedAgo = Math.abs(mins);
  const cat = util.normalizeCategory
    ? util.normalizeCategory(ev.category)
    : String(ev.category || "").trim();

  const maxStartedAgoByCategory = {
    music: 120,
    theatre: 120,
    cinema: 120,
    dance: 120,
    literature: 120,
    gastronomy: 120,
    games: 120,
    visual_arts: 240,
    party: 360
  };

  const maxAgo = maxStartedAgoByCategory[cat];
  return startedAgo <= (Number.isFinite(maxAgo) ? maxAgo : 120);
}

  /* =========================
     FILTERED VIEWS
  ========================= */
function getActiveFestivalConfig() {
  const cfg = App.CFG?.ACTIVE_FESTIVAL || null;
  if (!cfg || cfg.enabled !== true) return null;
  return cfg;
}

function normalizeFestivalText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function festivalTextIncludesAny(text, keywords = []) {
  const haystack = normalizeFestivalText(text);
  const needles = Array.isArray(keywords) ? keywords : [];

  return needles.some((kw) => {
    const needle = normalizeFestivalText(kw);
    return needle && haystack.includes(needle);
  });
}

function getFestivalAllowedCategories(cfg) {
  if (!cfg) return [];

  const fromList = Array.isArray(cfg.categories) ? cfg.categories : [];
  const fromSingle = cfg.category ? [cfg.category] : [];

  return [...new Set([...fromList, ...fromSingle]
    .map((cat) => util.normalizeCategory
      ? util.normalizeCategory(cat)
      : String(cat || "").trim()
    )
    .filter(Boolean)
  )];
}

function festivalAllowsCategory(ev, cfg) {
  const allowed = getFestivalAllowedCategories(cfg);
  if (!allowed.length) return true;

  const cat = util.normalizeCategory
    ? util.normalizeCategory(ev?.category)
    : String(ev?.category || "").trim();

  return allowed.includes(cat);
}

function isActiveFestivalModeActive() {
  const cfg = getActiveFestivalConfig();
  if (!cfg) return false;

  const start = String(cfg.start || "").trim();
  const end = String(cfg.end || "").trim();
  const today = util.todayStrYYYYMMDD();

  if (start && today < start) return false;
  if (end && today > end) return false;

  return true;
}

function isActiveFestivalEvent(ev) {
  const cfg = getActiveFestivalConfig();
  if (!cfg || !ev) return false;

  const date = String(ev.date || "").slice(0, 10);
  const start = String(cfg.start || "").trim();
  const end = String(cfg.end || "").trim();

  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;

  if (!festivalAllowsCategory(ev, cfg)) {
    return false;
  }

  const allowedSources = Array.isArray(cfg.sourceNames)
    ? cfg.sourceNames.map((s) => normalizeFestivalText(s)).filter(Boolean)
    : [];

  const source = normalizeFestivalText(ev.sourceName || ev.source_name || "");
  if (source && allowedSources.includes(source)) {
    return true;
  }

  const title = String(ev.title || "");
  const place = String(ev.placeName || ev.place_name || "");
  const link = String(ev.link || "");
  const sourceUrl = String(ev.sourceUrl || ev.source_url || "");

  if (festivalTextIncludesAny(title, cfg.titleKeywords || [])) {
    return true;
  }

  if (festivalTextIncludesAny(place, cfg.placeKeywords || [])) {
    return true;
  }

  if (festivalTextIncludesAny(link, cfg.linkKeywords || [])) {
    return true;
  }

  if (festivalTextIncludesAny(sourceUrl, cfg.linkKeywords || [])) {
    return true;
  }

  if (cfg.matchAllCategoryInRange === true) {
    return true;
  }

  return false;
}

function getActiveFestivalEvents(list = state.logic.events) {
  const safe = Array.isArray(list) ? list : [];
  return safe.filter(isActiveFestivalEvent);
}

function getVisibleActiveFestivalEvents(list = state.logic.events) {
  return util.filterByActiveCategory(getActiveFestivalEvents(list));
}

function getTodayActiveFestivalEvents(list = state.logic.events) {
  const today = util.todayStrYYYYMMDD();

  return getActiveFestivalEvents(list)
    .filter((ev) => {
      return util.isEventDisplayedOnDate
        ? util.isEventDisplayedOnDate(ev, today)
        : String(ev?.date || "").slice(0, 10) === today;
    })
    .sort(util.sortEventsByStatusThenTime);
}

function getSoonActiveFestivalEvents(list = state.logic.events) {
  const cfg = getActiveFestivalConfig();
  const soonMin = Number(cfg?.soonMin ?? 180);

  return getTodayActiveFestivalEvents(list)
    .filter((ev) => {
      const mins = safeMinutesToStart(ev);
      return mins !== null && mins >= -15 && mins <= soonMin;
    })
    .sort((a, b) => {
      const ma = safeMinutesToStart(a);
      const mb = safeMinutesToStart(b);
      return (ma ?? 999999) - (mb ?? 999999);
    });
}

function getActiveFestivalHeroData(list = state.logic.events) {
  const cfg = getActiveFestivalConfig();
  if (!cfg) return null;
  if (!isActiveFestivalModeActive()) return null;

  const all = getActiveFestivalEvents(list);
  if (!all.length) return null;

  const today = getTodayActiveFestivalEvents(list);

  if (cfg.showHeroOnlyOnEventDays !== false && !today.length) {
    return null;
  }

  const soon = getSoonActiveFestivalEvents(list);

  return {
    config: cfg,
    total: all.length,
    todayCount: today.length,
    soonCount: soon.length,
    todayEvents: today,
    soonEvents: soon,
    nextEvent: soon[0] || today[0] || all[0] || null
  };
}

function applyFestivalFilter(list = []) {
  const safe = Array.isArray(list) ? list : [];

  if (!state.logic.festivalOnly) return safe;

  if (!isActiveFestivalModeActive()) return safe;

  return safe.filter(isActiveFestivalEvent);
}
  
function getVisibleTodayEvents(list = state.logic.events) {
  const today = util.todayStrYYYYMMDD();
  const safe = Array.isArray(list) ? list : [];

  const filtered = util.filterByActiveCategory(safe);
  const festivalFiltered = applyFestivalFilter(filtered);

  return festivalFiltered.filter((ev) => {
    const isTodayDisplay = util.isEventDisplayedOnDate
      ? util.isEventDisplayedOnDate(ev, today)
      : String(ev?.date || "").slice(0, 10) === today;

    return isTodayDisplay && isStillRelevantForTodayAccordion(ev);
  });
}

function getVisibleFutureEvents(list = state.logic.events) {
  const today = util.todayStrYYYYMMDD();
  const safe = Array.isArray(list) ? list : [];

  const filtered = util.filterByActiveCategory(safe);
  const festivalFiltered = applyFestivalFilter(filtered);

  return festivalFiltered.filter((ev) => {
    const displayDate = util.getEventDisplayDate
      ? util.getEventDisplayDate(ev)
      : String(ev?.date || "").slice(0, 10);

    return !!displayDate && displayDate > today;
  });
}

function getVisibleEventsOnDate(dateStr, list = state.logic.events) {
  const safeDate = String(dateStr || "").slice(0, 10);
  const safe = Array.isArray(list) ? list : [];

  const filtered = util.filterByActiveCategory(safe);
  const festivalFiltered = applyFestivalFilter(filtered);

  return festivalFiltered.filter((ev) => {
    return util.isEventDisplayedOnDate
      ? util.isEventDisplayedOnDate(ev, safeDate)
      : String(ev?.date || "").slice(0, 10) === safeDate;
  });
}

  function getSelectedMapDate() {
  const selected = String(state.logic?.selectedMapDate || "").slice(0, 10);
  return selected || util.todayStrYYYYMMDD();
}

  function isMapPersistentCategory(category) {
  const cat = util.normalizeCategory(category);
  return cat === "visual_arts" || cat === "games";
}

function isMapTimedCategory(category) {
  const cat = util.normalizeCategory(category);
  return cat === "music" || cat === "dance" || cat === "theatre" || cat === "cinema" || cat === "party";
}

function isEventVisibleOnMap(ev, now = new Date(), dateStr = getSelectedMapDate()) {
  if (!ev?.date) return false;

  const targetDate = String(dateStr || "").slice(0, 10);
  if (!targetDate) return false;

  const isOnTargetDate = util.isEventDisplayedOnDate
    ? util.isEventDisplayedOnDate(ev, targetDate)
    : String(ev?.date || "").slice(0, 10) === targetDate;

  if (!isOnTargetDate) return false;

  const today = util.todayStrYYYYMMDD();

  // Si estoy mirando mañana, pasado mañana o una fecha elegida,
  // muestro todos los eventos de ese día.
  // La lógica de "ya empezó hace mucho" solo la aplico para HOY.
  if (targetDate !== today) {
    return true;
  }

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
  const festivalFiltered = applyFestivalFilter(base);
  const selectedDate = getSelectedMapDate();

  return festivalFiltered.filter((ev) => {
    return isEventVisibleOnMap(ev, new Date(), selectedDate);
  });
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
  const today = util.getTodayEvents(list || []);
  return applyFestivalFilter(today);
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

 function getTodayUrgencyRank(ev) {
  const mins = safeMinutesToStart(ev);

  if (mins === null) return 2;

  // 1) empieza pronto: arriba de todo
  if (mins >= 0 && mins <= 60) {
    return 0;
  }

  // 2) más tarde hoy
  if (mins > 60) {
    return 1;
  }

  // 3) recién empezó (hasta 20 min)
  if (mins < 0 && Math.abs(mins) <= 20) {
    return 2;
  }

  // 4) empezó hace más de 20 min
  return 3;
}

function sortTodayEventsByUrgencyAndDistance(list = [], nearbyCenter = state.logic.nearbyCenter) {
  const safe = Array.isArray(list) ? [...list] : [];

  return safe.sort((a, b) => {
    const rankA = getTodayUrgencyRank(a);
    const rankB = getTodayUrgencyRank(b);
    if (rankA !== rankB) return rankA - rankB;

    const distA = nearbyCenter && util.isValidCoord(a?.lat) && util.isValidCoord(a?.lng)
      ? util.distanceKm(nearbyCenter.lat, nearbyCenter.lng, Number(a.lat), Number(a.lng))
      : Infinity;

    const distB = nearbyCenter && util.isValidCoord(b?.lat) && util.isValidCoord(b?.lng)
      ? util.distanceKm(nearbyCenter.lat, nearbyCenter.lng, Number(b.lat), Number(b.lng))
      : Infinity;

    if (distA !== distB) return distA - distB;

    const timeA = (a?.startTime || "99:99").slice(0, 5);
    const timeB = (b?.startTime || "99:99").slice(0, 5);
    const byTime = timeA.localeCompare(timeB);
    if (byTime !== 0) return byTime;

    return (a?.title || "").localeCompare(b?.title || "");
  });
}

function getSortedVisibleTodayEvents(list = state.logic.events, nearbyCenter = state.logic.nearbyCenter) {
  const today = getVisibleTodayEvents(list);
  const sorted = sortTodayEventsByUrgencyAndDistance(today, nearbyCenter);
  return sortPartnerEventsFirst(sorted, () => 0);
}

function getDiscoveryBaseCandidates(list = state.logic.events) {
  const safe = Array.isArray(list) ? list : [];
  const excluded = new Set(
    (state.logic.discovery?.excludedEventIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  const visibleToday = getVisibleTodayEvents(safe);
  const visibleFuture = getVisibleFutureEvents(safe).slice(0, 60);

  return [...visibleToday, ...visibleFuture].filter((ev) => {
    const id = String(ev?.id || "").trim();
    return id && !excluded.has(id) && passesDiscoveryLeadTime(ev);
  });
}

function scoreDiscoveryCandidate(ev) {
  if (!ev) return -Infinity;

  let score = 0;
  const mins = safeMinutesToStart(ev);
  const nearbyCenter = state.logic.nearbyCenter;

  if (ev.date === util.todayStrYYYYMMDD()) {
    score += 30;
  }

  if (mins !== null) {
    if (mins >= 0 && mins <= 90) {
      score += 40 - Math.floor(mins / 3);
    } else if (mins > 90 && mins <= 240) {
      score += 12;
    } else if (mins < 0 && Math.abs(mins) <= 30) {
      score += 10;
    } else if (mins < 0) {
      score -= 25;
    }
  }

  if (
    nearbyCenter &&
    util.isValidCoord(ev?.lat) &&
    util.isValidCoord(ev?.lng)
  ) {
    const dist = util.distanceKm(
      nearbyCenter.lat,
      nearbyCenter.lng,
      Number(ev.lat),
      Number(ev.lng)
    );

    if (dist <= 1) score += 22;
    else if (dist <= 3) score += 14;
    else if (dist <= App.CFG.SEARCH_RADIUS_KM) score += 8;
    else if (dist <= 10) score += 2;
    else score -= 8;
  }

  if (
    state.logic.activeCategory !== "all" &&
    ev.category === state.logic.activeCategory
  ) {
    score += 8;
  }

  if (App.events?.isFavorite?.(ev.id)) {
    score += 4;
  }

  if (ev.flyerUrl) score += 1;
  if (ev.link) score += 1;

  return score;
}

function buildDiscoveryReason(ev) {
  const mins = safeMinutesToStart(ev);
  const nearbyCenter = state.logic.nearbyCenter;

  if (mins !== null && mins >= 0 && mins <= 60) {
    return `Empieza en ${mins} min`;
  }

  if (
    nearbyCenter &&
    util.isValidCoord(ev?.lat) &&
    util.isValidCoord(ev?.lng)
  ) {
    const dist = util.distanceKm(
      nearbyCenter.lat,
      nearbyCenter.lng,
      Number(ev.lat),
      Number(ev.lng)
    );

    if (dist <= 2) {
      return "Te queda cerca";
    }
  }

  if (ev.date === util.todayStrYYYYMMDD()) {
    return "Buena opción para hoy";
  }

  return "Plan recomendado";
}

function getDiscoverySuggestion() {
  const candidates = getDiscoveryBaseCandidates();
  if (!candidates.length) return null;

  const currentId = String(state.logic.discovery?.resultEventId || "").trim();
  const currentEvent = currentId
    ? App.events?.findEventById?.(currentId)
    : null;

  let ranked = [...candidates]
    .map((ev) => ({
      event: ev,
      score: scoreDiscoveryCandidate(ev)
    }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;

  // 1) evitar repetir el mismo evento actual si hay otras opciones
  if (currentId) {
    const withoutCurrent = ranked.filter(
      (item) => String(item.event?.id || "").trim() !== currentId
    );

    if (withoutCurrent.length) {
      ranked = withoutCurrent;
    }
  }

  // 2) si hay evento actual, intentar evitar también mismo título cuando se pueda
  if (currentEvent?.title) {
    const currentTitle = String(currentEvent.title || "").trim().toLowerCase();

    const withoutSameTitle = ranked.filter(
      (item) =>
        String(item.event?.title || "").trim().toLowerCase() !== currentTitle
    );

    if (withoutSameTitle.length) {
      ranked = withoutSameTitle;
    }
  }

  if (!ranked.length) return null;

  // 3) elegir dentro de una franja alta de score para variar sin perder calidad
  const bestScore = ranked[0].score;
  const topBand = ranked.filter((item) => item.score >= bestScore - 6);

  const pool = topBand.length ? topBand : ranked;
  const chosen = pool[Math.floor(Math.random() * pool.length)] || ranked[0];

  return {
    mode: "smart",
    event: chosen.event,
    score: chosen.score,
    reason: buildDiscoveryReason(chosen.event)
  };
}

  /* =========================
     EXPORT
  ========================= */
  App.selectors = {
    safeMinutesToStart,

    getPricingConfig,
    getEventPricingType,
    getEventPriceNote,
    getPricingLabel,
    getPricingBadge,
    isFreeEvent,

    isFeaturedEvent,
    getPlaceBadge,
    getFeaturedRank,

    getEventPartner,
    isPartnerEvent,
    getPartnerPriority,
    comparePartnerEventsFirst,
    sortPartnerEventsFirst,

    groupEventsByPlace,
    sortGroupedEventsByPriority,
    getGroupedEvents,

    getVisibleTodayEvents,
    getVisibleFutureEvents,
    getVisibleEventsOnDate,

    getGroupedTodayEvents,
    getGroupedFutureEvents,
    getGroupedNearbyEvents,

    getSelectedMapDate,
    isMapPersistentCategory,
    isMapTimedCategory,
    isEventVisibleOnMap,
    getMapVisibleEvents,

    getTodayNearbyEvents,
    getFeaturedNearbyEvents,
    getFeaturedNearbyEvent,
    getTodayUrgencyRank,
    sortTodayEventsByUrgencyAndDistance,
    isStillRelevantForTodayAccordion,
    getSortedVisibleTodayEvents,

    getDiscoveryBaseCandidates,
    passesDiscoveryLeadTime,
    scoreDiscoveryCandidate,
    buildDiscoveryReason,
    getDiscoverySuggestion,

    getActiveFestivalConfig,
    isActiveFestivalModeActive,
    isActiveFestivalEvent,
    getActiveFestivalEvents,
    getVisibleActiveFestivalEvents,
    getTodayActiveFestivalEvents,
    getSoonActiveFestivalEvents,
    getActiveFestivalHeroData,
    applyFestivalFilter,
  };
})();