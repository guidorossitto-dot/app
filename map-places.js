//map-places.js
(() => {
  "use strict";

  const App = window.App;
const { util, state, events, selectors } = App;

const VENUE_GUIDE_GROUPS = [
  {
    key: "bar_cultural",
    title: "🍸 Bar cultural"
  },
  {
    key: "centro_cultural",
    title: "🏛 Centro cultural"
  },
  {
    key: "juegos",
    title: "🎯 Juegos"
  },
  {
    key: "gastronomia",
    title: "🍷 Gastronomía"
  },
  {
    key: "teatro",
    title: "🎭 Teatro"
  },
  {
    key: "cine",
    title: "🎬 Cine"
  },
  {
    key: "galeria",
    title: "🖼️ Galería / Museo"
  },
  {
    key: "otros",
    title: "📍 Otros"
  }
];

function normalizeVenueGuideText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function isUsefulVenueUrl(value) {
  const url = String(value || "").trim();

  if (!url) return false;
  if (url.includes("PEGAR_")) return false;
  if (url.includes("DEJAR_VACIO")) return false;

  return /^https?:\/\//i.test(url);
}

function getVenueGuideGroupKey(venue) {
  const raw = String(venue?.guideGroup || "").trim();

  // Si no está clasificado, NO entra en la guía.
  if (!raw) return "";

  const exists = VENUE_GUIDE_GROUPS.some((group) => group.key === raw);

  // Si tiene un valor raro, lo mandamos a Otros.
  return exists ? raw : "otros";
}

function buildVenueGuideItemHTML(venue) {
  const lat = Number(venue?.lat);
  const lng = Number(venue?.lng);

  if (!venue || !venue.name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "";
  }

  const list = Array.isArray(state.logic?.events) ? state.logic.events : [];

  const key = util.smartLocationKey(
    {
      placeName: venue.name,
      lat,
      lng
    },
    list
  );

  const venueNameNorm = normalizeVenueGuideText(venue.name || "");
  const venueAddressNorm = normalizeVenueGuideText(venue.address || "");

  const safeAddress =
    venueAddressNorm && venueAddressNorm !== venueNameNorm
      ? venue.address
      : "";

  const meta = [
    venue.neighborhood || "",
    safeAddress
  ].filter(Boolean).join(" · ");

  const instagramBtn = isUsefulVenueUrl(venue.instagramUrl)
    ? `
      <a
        class="linkBtn"
        href="${escapeAttr(venue.instagramUrl)}"
        target="_blank"
        rel="noopener noreferrer">
        Instagram
      </a>
    `
    : "";

  const websiteBtn = isUsefulVenueUrl(venue.websiteUrl)
    ? `
      <a
        class="linkBtn"
        href="${escapeAttr(venue.websiteUrl)}"
        target="_blank"
        rel="noopener noreferrer">
        Web
      </a>
    `
    : "";

  const menuBtn = isUsefulVenueUrl(venue.menuUrl)
    ? `
      <a
        class="linkBtn"
        href="${escapeAttr(venue.menuUrl)}"
        target="_blank"
        rel="noopener noreferrer">
        Carta
      </a>
    `
    : "";

  return `
    <li class="venuesGuideItem">
      <div class="venuesGuideMain">
        <div class="venuesGuidePlace" data-place-title>${escapeHTML(venue.name)}</div>
        ${meta ? `<div class="venuesGuideMeta">${escapeHTML(meta)}</div>` : ""}
      </div>

      <div class="venuesGuideActions">
        ${instagramBtn}
        ${websiteBtn}
        ${menuBtn}

        <button
          type="button"
          class="linkBtn venuesGuideMapBtn"
          data-lat="${lat}"
          data-lng="${lng}"
          data-key="${escapeAttr(key)}"
          data-venue-id="${escapeAttr(encodeURIComponent(venue.id || ""))}"
          data-place-title="${escapeAttr(encodeURIComponent(venue.name || ""))}">
          Ver en mapa
        </button>
      </div>
    </li>
  `;
}

function buildVenueGuideHTML() {
 const venues = Array.isArray(state.logic?.venues)
  ? state.logic.venues
      .filter((venue) => {
        const groupKey = getVenueGuideGroupKey(venue);

        return (
          groupKey &&
          venue &&
          venue.name &&
          Number.isFinite(Number(venue.lat)) &&
          Number.isFinite(Number(venue.lng))
        );
      })
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
  : [];

  if (!venues.length) {
    return `
      <div class="nearbySmall">
        Todavía no hay lugares clasificados para mostrar en esta guía.
      </div>
    `;
  }

  const grouped = new Map();

  VENUE_GUIDE_GROUPS.forEach((group) => {
    grouped.set(group.key, {
      ...group,
      venues: []
    });
  });

  venues.forEach((venue) => {
    const groupKey = getVenueGuideGroupKey(venue);
    const targetGroup = grouped.get(groupKey) || grouped.get("otros");

    if (targetGroup) {
      targetGroup.venues.push(venue);
    }
  });

  const groupsHTML = [...grouped.values()]
    .map((group) => {
      const itemsHTML = group.venues
        .map(buildVenueGuideItemHTML)
        .filter(Boolean)
        .join("");

      if (!itemsHTML) return "";

      return `
        <details class="venuesGuideCategory">
          <summary class="venuesGuideCategorySummary">
            <span>${escapeHTML(group.title)}</span>
          </summary>

          <ul class="venuesGuideList">
            ${itemsHTML}
          </ul>
        </details>
      `;
    })
    .filter(Boolean)
    .join("");

  return groupsHTML || `
    <div class="nearbySmall">
      Todavía no hay lugares listos para mostrar en esta guía.
    </div>
  `;
}

function renderVenueGuide() {
  const root = document.getElementById("venuesGuide");
  if (!root) return;

  root.innerHTML = buildVenueGuideHTML();
}

function bindVenueGuideUI() {
  const root = document.getElementById("venuesGuide");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".venuesGuideMapBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    App.actions?.focusPlaceOnMapFlow?.({ button: btn });
  });
}

  /* =========================
     INPUTS USER
  ========================= */
  function setUserInputs(lat, lng) {
    const uLat = document.getElementById("userLat");
    const uLng = document.getElementById("userLng");
    if (uLat) uLat.value = Number(lat).toFixed(6);
    if (uLng) uLng.value = Number(lng).toFixed(6);
  }

  /* =========================
     CATEGORY ICONS
  ========================= */
  function categoryEmoji(cat) {
  return util.categoryEmoji(cat) || "📍";
}

  const _catIconCache = new Map();

  function getCategoryIcon(cat) {
    const key = cat || "default";
    if (_catIconCache.has(key)) return _catIconCache.get(key);

    const icon = L.divIcon({
      className: "",
      html: `<div class="catMarker">${categoryEmoji(cat)}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    _catIconCache.set(key, icon);
    return icon;
  }

  function categoryTagHTML(ev) {
    const t = util.categoryLabel(ev?.category);
    return t ? ` <span class="catTag">${t}</span>` : "";
  }

  function uiSetView(lat, lng, zoom) {
  if (!state.runtime.map) return;

  App.events?.setUiPanZoomInProgress?.(true);
  try {
    state.runtime.map.setView([lat, lng], zoom, { animate: true });
  } finally {
    setTimeout(() => {
      App.events?.setUiPanZoomInProgress?.(false);
    }, 250);
  }
}

  function glowMarker(marker) {
    try {
      const el = marker?.getElement?.();
      if (!el) return;
      el.classList.add("marker-highlight");
      setTimeout(() => el.classList.remove("marker-highlight"), 900);
    } catch {}
  }

  /* =========================
     MARKERS HELPERS
  ========================= */
  function clearEventMarkers() {
  if (state.runtime.markerCluster) state.runtime.markerCluster.clearLayers();
}

  function findLocationMarkerByEvent(ev, { rebuildIfMissing = true } = {}) {
  if (!ev) return null;

  let key = util.smartLocationKey(ev, state.logic.events || []);
  let loc = state.runtime.locationMarkers?.[key] || null;

  if (!loc && rebuildIfMissing) {
    rebuildLocationMarkers(state.logic.events);
    key = util.smartLocationKey(ev, state.logic.events || []);
    loc = state.runtime.locationMarkers?.[key] || null;
  }

  return loc;
}

function clearTemporaryFocusMarker() {
  const marker = state.runtime.temporaryFocusMarker;
  if (!marker) return;

  try {
    if (state.runtime.deepLinkLayer && state.runtime.deepLinkLayer.hasLayer?.(marker)) {
      state.runtime.deepLinkLayer.removeLayer(marker);
    } else if (state.runtime.map && state.runtime.map.hasLayer?.(marker)) {
      state.runtime.map.removeLayer(marker);
    }
  } catch {}

  state.runtime.temporaryFocusMarker = null;
}

function restoreActivePopupIfPossible() {
  if (!state.runtime.map) return false;
  if (!state.runtime.activePopupWantsPreserve) return false;

  const locationKey = String(state.runtime.activePopupLocationKey || "").trim();
  const eventId = String(state.runtime.activePopupEventId || "").trim();

  let loc = locationKey ? state.runtime.locationMarkers?.[locationKey] : null;

  if (!loc && eventId) {
    const ev = App.events?.findEventById?.(eventId) || null;
    if (ev) {
      loc = findLocationMarkerByEvent(ev, { rebuildIfMissing: true });
    }
  }

  if (!loc?.marker) return false;

  skipNextPopupMarginClose(2);
  openMarkerPopupStable(loc.marker, loc.lat, loc.lng, 17, {
    preservePopup: true,
    eventId: eventId || null,
    locationKey: locationKey || null
  });

  return true;
}

function setTemporaryFocusMarker(marker) {
  clearTemporaryFocusMarker();
  state.runtime.temporaryFocusMarker = marker || null;
}

 function highlightNearbyMarkers(filteredEvents) {
  const nearbyKeys = new Set(
    (filteredEvents || []).map((ev) => util.smartLocationKey(ev, state.logic.events || []))
  );

  Object.entries(state.runtime.locationMarkers || {}).forEach(([key, loc]) => {
    const isNear = nearbyKeys.has(key);
    if (loc?.marker?.setOpacity) loc.marker.setOpacity(isNear ? 1 : 0.35);
  });
}

  /* =========================
     REBUILD LOCATION MARKERS
  ========================= */
 function openMarkerPopupStable(marker, lat, lng, zoom = 17, opts = {}) {
  if (!marker || !state.runtime.map) return;

  const {
    preservePopup = true,
    eventId = null,
    locationKey = null
  } = opts;

  const map = state.runtime.map;
  const targetZoom = Math.max(map.getZoom(), zoom);

  if (preservePopup) {
    setActivePopupIntent({
      eventId,
      locationKey,
      lat,
      lng,
      preserve: true
    });
  }

  skipNextPopupMarginClose(2);
  App.events?.setUiPanZoomInProgress?.(true);

  const finishOpen = () => {
    const once = () => {
      map.off("moveend", once);
      skipNextPopupMarginClose(1);

      try {
        marker.openPopup();
      } catch {}

      try {
        glowMarker(marker);
      } catch {}

      setTimeout(() => {
        App.events?.setUiPanZoomInProgress?.(false);
        closePopupIfTouchesMargin({ margin: 12 });
      }, 80);
    };

    map.on("moveend", once);
    map.setView([lat, lng], targetZoom, { animate: true });
  };

const canUseClusterZoom =
  !!state.runtime.markerCluster &&
  typeof state.runtime.markerCluster.zoomToShowLayer === "function" &&
  typeof state.runtime.markerCluster.hasLayer === "function" &&
  state.runtime.markerCluster.hasLayer(marker);

if (canUseClusterZoom) {
  state.runtime.markerCluster.zoomToShowLayer(marker, () => {
    skipNextPopupMarginClose(2);
    finishOpen();
  });
} else {
  finishOpen();
}
}

function rebuildLocationMarkers(list = state.logic.events) {
  if (!state.runtime.map || !state.runtime.markerCluster) return;

  clearEventMarkers();
  state.runtime.locationMarkers = {};

const visibleMapEvents = selectors?.getMapVisibleEvents?.(list || []) || [];

for (const ev of visibleMapEvents) {
  if (!util.isValidCoord(ev.lat) || !util.isValidCoord(ev.lng)) continue;
    const key = util.smartLocationKey(ev, list);

    if (!state.runtime.locationMarkers[key]) {
      const anchor = util.findPlaceAnchor(ev, list) || {
        lat: ev.lat,
        lng: ev.lng,
        placeName: ev.placeName || ""
      };

      const marker = L.marker([anchor.lat, anchor.lng], {
        bubblingMouseEvents: false,
        icon: getCategoryIcon(ev.category || "music")
      });

    state.runtime.markerCluster.addLayer(marker);

state.runtime.locationMarkers[key] = {
  marker,
  events: [],
  lat: anchor.lat,
  lng: anchor.lng,
  placeName: anchor.placeName
};

marker.off("popupclose");
marker.on("popupclose", () => {
  if (consumePopupIntentClearSkip()) return;
  clearActivePopupIntent();
});

let clickTimer = null;

marker.on("click", (e) => {
  if (e?.originalEvent) L.DomEvent.stop(e.originalEvent);

  if (clickTimer) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    marker.openPopup();
    clickTimer = null;
  }, 180);
});

      marker.on("dblclick", (e) => {
        if (e?.originalEvent) L.DomEvent.stop(e.originalEvent);

        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }

        const { lat, lng } = state.runtime.locationMarkers[key];

        setUserLocation(lat, lng);
        recomputeNearbyEvents(lat, lng);
        state.runtime.map.setView([lat, lng], 15);

        setTimeout(() => {
          try {
            marker.openPopup();
          } catch {}
        }, 120);

        if (util.canManageUI()) prepareEventCreation(lat, lng);
        App.renderAll?.({ rebuildMarkers: false });
      });
    }

    state.runtime.locationMarkers[key].events.push(ev);
  }

  Object.values(state.runtime.locationMarkers).forEach((loc) => {
    const html = App.map?.buildPlacePopupHTML?.(loc) || "";

    loc.marker.bindPopup(html, {
  closeButton: true,
  autoPan: false,
  keepInView: false,
  offset: [0, -10],
  maxWidth: 260,
  minWidth: 180
});

loc.marker.off("popupclose");
loc.marker.on("popupclose", () => {
  if (consumePopupIntentClearSkip()) return;
  clearActivePopupIntent();
});

loc.marker.off("popupopen");
loc.marker.on("popupopen", (evt) => {
  const root = evt.popup.getElement();
  if (!root) return;

  L.DomEvent.disableClickPropagation(root);
  L.DomEvent.disableScrollPropagation(root);

  const onClick = async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

  if (btn.classList.contains("popupCenterBtn")) {
    const lat = parseFloat(btn.dataset.lat);
    const lng = parseFloat(btn.dataset.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.runtime.map) return;

    const marker = loc?.marker;
    if (!marker) return;

openMarkerPopupStable(marker, lat, lng, 17, {
  preservePopup: true,
  eventId: state.runtime.activePopupEventId || null
});
    return;
  }

  if (btn.classList.contains("shareBtn")) {
    await App.ui?.shareEventFromButton?.(btn);
    return;
  }

  if (btn.classList.contains("popupRouteBtn")) {
    App.actions?.routeToEventFlow?.({ button: btn });
    return;
  }

  if (btn.classList.contains("popupEditBtn")) {
    const eventId = decodeURIComponent((btn.dataset.editEid || "").trim());
    if (!eventId) return;

    await App.adminForm?.startEditingEventFromId?.(eventId);
    return;
  }

  if (btn.classList.contains("favoriteBtn")) {
    const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
    if (!eventId) return;

    const result = App.actions?.toggleFavorite?.(eventId);
    if (!result?.ok) return;

    const isFav = !!result.isFavorite;
    btn.setAttribute("aria-pressed", isFav ? "true" : "false");
    btn.textContent = isFav ? "❤️ Guardado" : "🤍 Guardar";

    App.ui?.renderCalendar?.();
    App.ui?.paintCategoryUI?.();
    return;
  }

  if (!util.canManageUI()) return;

  if (btn.classList.contains("deleteEventBtn")) {
    await App.ui?.deleteEventFromButton?.(btn);

    if (
      state.runtime.deepLinkLayer &&
      typeof state.runtime.deepLinkLayer.clearLayers === "function"
    ) {
      state.runtime.deepLinkLayer.clearLayers();
    }
    return;
  }

  if (btn.classList.contains("popupAddBtn")) {
    const lat = Number(btn.dataset.lat);
    const lng = Number(btn.dataset.lng);
    const place = decodeURIComponent(btn.dataset.place || "");

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.runtime.map) return;

    uiSetView(lat, lng, 15);
    prepareEventCreation(lat, lng);

    const placeEl = document.getElementById("eventPlace");
    if (placeEl && place && !placeEl.value.trim()) placeEl.value = place;

    const titleEl = document.getElementById("eventTitle");
    if (titleEl) titleEl.focus();

    App.renderAll?.({ rebuildMarkers: false });
    return;
  }
};

      root.addEventListener("click", onClick, true);

      evt.popup.once("remove", () => {
        root.removeEventListener("click", onClick, true);
      });

      const popupEventIds = Array.isArray(loc.events)
  ? loc.events.map((e) => String(e?.id || "").trim()).filter(Boolean)
  : [];

const preferredEventId =
  state.runtime.pendingOpenEventId && popupEventIds.includes(String(state.runtime.pendingOpenEventId))
    ? String(state.runtime.pendingOpenEventId)
    : (popupEventIds[0] || null);

setActivePopupIntent({
  eventId: preferredEventId,
  locationKey: Object.keys(state.runtime.locationMarkers).find(
    (k) => state.runtime.locationMarkers[k] === loc
  ) || null,
  lat: loc.lat,
  lng: loc.lng,
  preserve: true
});


      const pending = state.runtime.pendingOpenEventId;
      if (pending) {
        const sel = `[data-eid="${encodeURIComponent(String(pending))}"]`;
        const row = root.querySelector(sel);

        if (row) {
          row.classList.add("popupItemHighlight");
          row.scrollIntoView({ block: "center", behavior: "smooth" });
          setTimeout(() => row.classList.remove("popupItemHighlight"), 1600);
        }

        App.actions?.clearPendingPopupEvent?.();
      }
    });

    loc.marker.setOpacity(1);
  });

  if (
    state.runtime.markerCluster &&
    typeof state.runtime.markerCluster.refreshClusters === "function"
  ) {
    try {
      state.runtime.markerCluster.refreshClusters();
    } catch {}
  }

  setTimeout(() => {
    try {
      state.runtime.map.invalidateSize();
    } catch {}

    try {
      state.runtime.map.panBy([0, 0], { animate: false });
    } catch {}
  }, 80);
}

  /* =========================
     NEARBY STATE
  ========================= */
 function recomputeNearbyEvents(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    App.actions?.setNearbyCenter?.(null);
    App.actions?.setNearbyEvents?.([]);
    return [];
  }

  const nearby = util.getNearbyTodayEvents(lat, lng, state.logic.events || []);

  App.actions?.setNearbyCenter?.({ lat, lng });
  App.actions?.setNearbyEvents?.(nearby);

  return nearby;
}

  function filterEventsByDistance(lat, lng) {
  const filtered = recomputeNearbyEvents(lat, lng);
  App.renderAll?.({ rebuildMarkers: false });
  return filtered;
}

  function renderMap(opts = {}) {
  const { rebuildMarkers = true } = opts;

  if (rebuildMarkers) {
    rebuildLocationMarkers(state.logic.events);
  }

  highlightNearbyMarkers(state.logic.nearbyEvents || []);
  renderVenueGuide();
}

  /* =========================
     USER LOCATION + EVENT CREATION
  ========================= */
  function setUserLocation(lat, lng) {
  if (!state.runtime.map) return;

  setUserInputs(lat, lng);

  if (state.runtime.userMarker) {
    state.runtime.userMarker.setLatLng([lat, lng]);
  } else {
    state.runtime.userMarker = L.marker([lat, lng], { draggable: true }).addTo(state.runtime.map);

    state.runtime.userMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      setUserInputs(pos.lat, pos.lng);
      recomputeNearbyEvents(pos.lat, pos.lng);
      App.renderAll?.({ rebuildMarkers: false });
    });
  }
}

  function prepareEventCreation(lat, lng) {
  const eLat = document.getElementById("eventLat");
  const eLng = document.getElementById("eventLng");
  if (eLat) eLat.value = Number(lat).toFixed(6);
  if (eLng) eLng.value = Number(lng).toFixed(6);

  if (!state.runtime.map) return;

    if (state.runtime.userMarker) {
    state.runtime.userMarker.remove();
    state.runtime.userMarker = null;
  }

  if (state.runtime.eventCreationMarker) {
    state.runtime.eventCreationMarker.setLatLng([lat, lng]);
  } else {
    state.runtime.eventCreationMarker = L.marker([lat, lng], { draggable: true }).addTo(state.runtime.map);

    state.runtime.eventCreationMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      const eLat2 = document.getElementById("eventLat");
      const eLng2 = document.getElementById("eventLng");
      if (eLat2) eLat2.value = pos.lat.toFixed(6);
      if (eLng2) eLng2.value = pos.lng.toFixed(6);
    });
  }
}

  function clearEventCreationMarker() {
  if (state.runtime.eventCreationMarker) {
    state.runtime.eventCreationMarker.remove();
    state.runtime.eventCreationMarker = null;
  }
}


  /* =========================
     GEOLOCATION + INPUT SEARCH
  ========================= */
  function useMyLocation(opts = {}) {
  const {
    silent = false,
    fallbackLat = -34.6037,
    fallbackLng = -58.3816
  } = opts;

  function applyLocation(lat, lng, zoom = 15) {
    setUserLocation(lat, lng);
    recomputeNearbyEvents(lat, lng);
    uiSetView(lat, lng, zoom);
    App.renderAll?.({ rebuildMarkers: false });
  }

  if (!navigator.geolocation) {
    applyLocation(fallbackLat, fallbackLng, 14);

    if (!silent) {
      alert("Tu navegador no soporta geolocalización.");
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      applyLocation(lat, lng, 15);
    },
    (err) => {
      applyLocation(fallbackLat, fallbackLng, 14);

      if (!silent) {
        alert("No se pudo obtener la ubicación: " + err.message);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

  function searchNearbyFromInputs() {
  const latEl = document.getElementById("userLat");
  const lngEl = document.getElementById("userLng");
  if (!latEl || !lngEl) return;

  const lat = Number(latEl.value);
  const lng = Number(lngEl.value);

  if (!util.isValidCoord(lat) || !util.isValidCoord(lng)) {
    alert("Ingresá latitud y longitud válidas.");
    return;
  }

  setUserLocation(lat, lng);
  recomputeNearbyEvents(lat, lng);
  uiSetView(lat, lng, 15);

  App.renderAll?.({ rebuildMarkers: false });
}

function getOpenPopupSafe() {
  if (!state.runtime.map) return null;

  try {
    return state.runtime.map._popup || null;
  } catch {
    return null;
  }
}

function consumePopupMarginSkip() {
  const n = Number(state.runtime.skipPopupMarginCloseCount || 0);
  if (n > 0) {
    state.runtime.skipPopupMarginCloseCount = n - 1;
    return true;
  }
  return false;
}

function skipNextPopupMarginClose(times = 1) {
  const n = Number(state.runtime.skipPopupMarginCloseCount || 0);
  state.runtime.skipPopupMarginCloseCount = n + Math.max(1, Number(times) || 1);
}

function popupTouchesMapMargin(popup, margin = 12) {
  const mapEl = document.getElementById("map");
  const popupEl = popup?.getElement?.();

  if (!mapEl || !popupEl) return false;

  const mapRect = mapEl.getBoundingClientRect();
  const popupRect = popupEl.getBoundingClientRect();

  return (
    popupRect.left <= mapRect.left + margin ||
    popupRect.right >= mapRect.right - margin ||
    popupRect.top <= mapRect.top + margin ||
    popupRect.bottom >= mapRect.bottom - margin
  );
}

function consumePopupIntentClearSkip() {
  const n = Number(state.runtime.skipPopupIntentClearCount || 0);
  if (n > 0) {
    state.runtime.skipPopupIntentClearCount = n - 1;
    return true;
  }
  return false;
}

function skipNextPopupIntentClear(times = 1) {
  const n = Number(state.runtime.skipPopupIntentClearCount || 0);
  state.runtime.skipPopupIntentClearCount = n + Math.max(1, Number(times) || 1);
}

function closePopupIfTouchesMargin({ margin = 12 } = {}) {
  const popup = getOpenPopupSafe();
  if (!popup || !state.runtime.map) return;

  if (state.runtime.uiPanZoomInProgress) return;
  if (consumePopupMarginSkip()) return;

  if (popupTouchesMapMargin(popup, margin)) {
    clearActivePopupIntent();
    state.runtime.map.closePopup();
  }
}

function setActivePopupIntent({ eventId = null, locationKey = null, lat = null, lng = null, preserve = true } = {}) {
  state.runtime.activePopupEventId = eventId ? String(eventId) : null;
  state.runtime.activePopupLocationKey = locationKey ? String(locationKey) : null;
  state.runtime.activePopupLatLng =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  state.runtime.activePopupWantsPreserve = !!preserve;
}

function clearActivePopupIntent() {
  state.runtime.activePopupEventId = null;
  state.runtime.activePopupLocationKey = null;
  state.runtime.activePopupLatLng = null;
  state.runtime.activePopupWantsPreserve = false;
}

  /* =========================
     MAP INIT
  ========================= */

  function clearPendingMapClick() {
  if (state.runtime.pendingMapClickTimer) {
    clearTimeout(state.runtime.pendingMapClickTimer);
    state.runtime.pendingMapClickTimer = null;
  }
}

function handleMapSingleClick(e) {
  App.ui?.closeSidebarMobileIfOpen?.();

  const t = e.originalEvent?.target;
  if (t && (t.closest?.(".leaflet-marker-icon") || t.closest?.(".leaflet-popup"))) return;

  const clat = e.latlng.lat;
  const clng = e.latlng.lng;

  if (util.canManageUI() && state.runtime.eventCreationMarker) {
    prepareEventCreation(clat, clng);
    uiSetView(clat, clng, 15);
    App.renderAll?.({ rebuildMarkers: false });
    return;
  }

  setUserLocation(clat, clng);
  recomputeNearbyEvents(clat, clng);
  uiSetView(clat, clng, 15);

  App.renderAll?.({ rebuildMarkers: false });
}

  function initMap(lat, lng) {
  state.runtime.map = L.map("map", {
    closePopupOnClick: false
  }).setView([lat, lng], 15);

state.runtime.map.doubleClickZoom.enable();

  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(state.runtime.map);

const mapStageEl = document.querySelector(".mapStage");

function markMapReady() {
  if (mapStageEl) {
    mapStageEl.classList.add("is-ready");
  }
}

tiles.on("load", markMapReady);
state.runtime.map.whenReady(() => {
  setTimeout(markMapReady, 80);
});

  state.runtime.markerCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 16
  });

state.runtime.markerCluster.on("animationend", () => {
  if (!state.runtime.activePopupWantsPreserve) return;
  if (state.runtime.uiPanZoomInProgress) return;
  if (getOpenPopupSafe()) return;

  restoreActivePopupIfPossible();
});

  state.runtime.map.addLayer(state.runtime.markerCluster);
  state.runtime.deepLinkLayer = L.layerGroup().addTo(state.runtime.map);

  state.runtime.map.on("click", (e) => {
  clearPendingMapClick();

  state.runtime.pendingMapClickTimer = setTimeout(() => {
    state.runtime.pendingMapClickTimer = null;
    handleMapSingleClick(e);
  }, 220);
});

state.runtime.map.on("dblclick", (e) => {
  clearPendingMapClick();
  App.ui?.closeSidebarMobileIfOpen?.();
});

  state.runtime.map.on("dragstart", () => {
    App.ui?.closeSidebarMobileIfOpen?.();
  });

state.runtime.map.on("dragend", () => {
  closePopupIfTouchesMargin({ margin: 12 });
});

state.runtime.map.on("moveend", () => {
  closePopupIfTouchesMargin({ margin: 12 });
});

 state.runtime.map.on("zoomstart", () => {
  App.ui?.closeSidebarMobileIfOpen?.();
  state.runtime.lastZoomBeforeChange = state.runtime.map.getZoom();
});

state.runtime.map.on("zoomend", () => {
  const prevZoom = Number(state.runtime.lastZoomBeforeChange);
  const nextZoom = Number(state.runtime.map.getZoom());

  if (Number.isFinite(prevZoom) && Number.isFinite(nextZoom) && nextZoom < prevZoom) {
    clearActivePopupIntent();
    state.runtime.skipPopupMarginCloseCount = 0;
    state.runtime.skipPopupIntentClearCount = 0;
    state.runtime.map.closePopup();
    return;
  }

  if (consumePopupMarginSkip()) return;

  closePopupIfTouchesMargin({ margin: 12 });
});
}

  /* =========================
     LISTENER: Ver en mapa
  ========================= */
  
  /* =========================
     NOMINATIM
  ========================= */
  async function searchPlacesNominatim(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Error buscando lugares");
    return await res.json();
  }

  function renderPlaceResults(results) {
    const ul = document.getElementById("placeResults");
    if (!ul) return;
    ul.innerHTML = "";

    if (!results || results.length === 0) {
      ul.innerHTML = "<li>No se encontraron lugares</li>";
      return;
    }

    results.forEach((r) => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.textContent = r.display_name;

      li.onclick = () => {
        const lat = Number(r.lat);
        const lng = Number(r.lon);

        if (state.runtime.map) state.runtime.map.closePopup();

        if (state.runtime.map && Number.isFinite(lat) && Number.isFinite(lng)) {
        state.runtime.map.setView([lat, lng], 16);
      }

        const latEl = document.getElementById("eventLat");
        const lngEl = document.getElementById("eventLng");
        if (latEl) latEl.value = lat.toFixed(6);
        if (lngEl) lngEl.value = lng.toFixed(6);

        const placeEl = document.getElementById("eventPlace");
        if (placeEl) placeEl.value = util.shortPlaceName(r.name || r.display_name);

        const titleEl = document.getElementById("eventTitle");
        if (titleEl && !titleEl.value.trim()) {
          titleEl.value = r.name || r.display_name.split(",")[0];
        }

        if (util.canManageUI()) prepareEventCreation(lat, lng);
        
        const resultsUl = document.getElementById("placeResults");
        if (resultsUl) resultsUl.innerHTML = "";

        const qInput = document.getElementById("placeQuery");
        if (qInput) qInput.value = "";
      };

      ul.appendChild(li);
    });
  }

  function bindAdminCategoryChips() {
    const row = document.getElementById("adminCategoryChips");
    const hidden = document.getElementById("eventCategory");
    if (!row || !hidden) return;

    const chips = [...row.querySelectorAll(".chip[data-cat]")];

    function setActive(cat) {
      hidden.value = cat;
      chips.forEach((b) => b.classList.toggle("isActive", b.dataset.cat === cat));
    }

    setActive(hidden.value || "music");

    chips.forEach((b) => {
      b.addEventListener("click", () => setActive(b.dataset.cat || "music"));
    });
  }

  function bindPlaceSearchUI() {
    const btn = document.getElementById("searchPlaceBtn");
    const input = document.getElementById("placeQuery");
    if (!btn || !input) return;

    btn.addEventListener("click", async () => {
      const q = input.value.trim();
      if (!q) return;

      btn.disabled = true;
      btn.textContent = "Buscando...";

      try {
        const results = await searchPlacesNominatim(q);
        renderPlaceResults(results);
      } catch (e) {
        alert("No se pudo buscar el lugar.");
        console.error(e);
      } finally {
        btn.disabled = false;
        btn.textContent = "Buscar";
      }
    });
  }

  /* =========================
     DEEP LINK TARGET
  ========================= */
 function focusEventById(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return false;

   if (typeof gtag === "function") {
    gtag('event', 'open_event', {
      event_id: id
    });
  }

  const ev = App.events?.findEventById?.(id) || null;
  if (!ev || !state.runtime.map) return false;

  if (
    state.runtime.deepLinkLayer &&
    typeof state.runtime.deepLinkLayer.clearLayers === "function"
  ) {
    state.runtime.deepLinkLayer.clearLayers();
  }

  let key = util.smartLocationKey(ev, state.logic.events || []);
  let loc = state.runtime.locationMarkers?.[key];

  if (!loc) {
    rebuildLocationMarkers(state.logic.events);
    key = util.smartLocationKey(ev, state.logic.events || []);
    loc = state.runtime.locationMarkers?.[key];
  }

  if (loc?.marker) {
    App.actions?.highlightPendingPopupEvent?.(id);
openMarkerPopupStable(loc.marker, ev.lat, ev.lng, 17, {
  preservePopup: true,
  eventId: id,
  locationKey: key
});
    return true;
  }

  const placeTitle = util.shortPlaceName(ev.placeName) || "Lugar sin nombre";
  const st = util.formatTimeStart(ev);
  const status = util.getEventStatus(ev);

  const html = `
    <div class="popupCard">
      <div class="popupHeader">
        <div>
          <div class="popupPlace">${placeTitle}</div>
          <div class="popupSub">Evento (link compartido)</div>
        </div>
      </div>

      <div class="popupList">
        <div class="popupItem popupItemHighlight">
          <div class="popupItemTitle">
            ${st ? `<span style="opacity:.75;margin-right:6px">${st}</span>` : ""}
            ${ev.title}
            ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
          </div>
          <div class="popupItemMeta">${util.formatDateDisplay(ev.date)}</div>
        </div>
      </div>
    </div>
  `;

  const markerOpts = {};
  try {
    markerOpts.icon = getCategoryIcon(ev.category || "music");
    markerOpts.bubblingMouseEvents = false;
  } catch {}

const m = L.marker([ev.lat, ev.lng], markerOpts);

m.bindPopup(html, {
  closeButton: true,
  autoPan: false,
  keepInView: false,
  offset: [0, -10],
  maxWidth: 260,
  minWidth: 180
});

  m.on("popupclose", () => {
  if (state.runtime.temporaryFocusMarker === m) {
    clearTemporaryFocusMarker();
  }
});

  if (state.runtime.deepLinkLayer) {
    m.addTo(state.runtime.deepLinkLayer);
  } else {
    m.addTo(state.runtime.map);
  }

  clearTemporaryFocusMarker();
  setTemporaryFocusMarker(m);
openMarkerPopupStable(m, ev.lat, ev.lng, 17, {
  preservePopup: true,
  eventId: id,
  locationKey: null
});

  setTimeout(() => {
    const el = m.getElement?.();
    if (el) {
      el.classList.add("marker-highlight");
      setTimeout(() => el.classList.remove("marker-highlight"), 900);
    }
  }, 50);

  return true;
}

async function clearAllEvents() {
  if (!confirm("¿Seguro que querés borrar todos los eventos?")) return;

  const result = await App.events?.clearAllEvents?.();
  if (!result?.ok) {
    alert("No se pudieron borrar los eventos.");
    return;
  }

  App.actions?.stopEditingEvent?.();
  App.actions?.setNearbyEvents?.([]);
  App.actions?.setNearbyCenter?.(null);

  App.commit?.({
    persist: true,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });
}

function focusPlaceByCoords(lat, lng, html, zoom = 17) {
  if (!state.runtime.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const tempMarker = L.marker([lat, lng], {
    interactive: false,
    keyboard: false,
    opacity: 0
  });

  tempMarker.bindPopup(html, {
  closeButton: true,
  autoPan: false,
  keepInView: false,
  offset: [0, -10],
  maxWidth: 260,
  minWidth: 180
});

  tempMarker.addTo(state.runtime.deepLinkLayer || state.runtime.map);

  openMarkerPopupStable(tempMarker, lat, lng, zoom, {
  preservePopup: true,
  eventId: null,
  locationKey: null
});

  return true;
}

/* =========================
     EXPORT MAP MODULE
  ========================= */
   App.map = {
    ...(App.map || {}),
    initMap,
    rebuildMarkers: rebuildLocationMarkers,
    rebuildLocationMarkers,
    renderMap,
    recomputeNearbyEvents,
    filterEventsByDistance,
    setUserLocation,
    prepareEventCreation,
    setTemporaryFocusMarker,
    clearEventCreationMarker,
    clearTemporaryFocusMarker,
    useMyLocation,
    searchNearbyFromInputs,
    bindAdminCategoryChips,
    bindPlaceSearchUI,
    focusEventById,
    focusPlaceByCoords,
    openMarkerPopupStable,
    renderVenueGuide,
bindVenueGuideUI,
    clearAllEvents
  };

  App.map.bindPlaceSearchUI();
  App.map.bindVenueGuideUI();
})();