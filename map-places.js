(() => {
  "use strict";

  const App = window.App;
  const { util, state, events } = App;

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
    switch (cat) {
      case "music": return "🎵";
      case "dance": return "💃";
      case "theatre": return "🎭";
      case "visual_arts": return "🖼️";
      default: return "📍";
    }
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
  function openMarkerPopupStable(marker, lat, lng, zoom = 17) {
  if (!marker || !state.runtime.map) return;

  const targetZoom = Math.max(state.runtime.map.getZoom(), zoom);

  const doOpen = () => {
    App.events?.setUiPanZoomInProgress?.(true);

    try {
      state.runtime.map.setView([lat, lng], targetZoom, { animate: true });

      setTimeout(() => {
        try {
          marker.openPopup();
        } catch {}

        try {
          if (typeof glowMarker === "function") glowMarker(marker);
        } catch {}
      }, 120);
    } finally {
      setTimeout(() => {
        App.events?.setUiPanZoomInProgress?.(false);
      }, 300);
    }
  };

  if (
    state.runtime.markerCluster &&
    typeof state.runtime.markerCluster.zoomToShowLayer === "function"
  ) {
    state.runtime.markerCluster.zoomToShowLayer(marker, doOpen);
  } else {
    doOpen();
  }
}

function rebuildLocationMarkers(list = state.logic.events) {
  if (!state.runtime.map || !state.runtime.markerCluster) return;

  clearEventMarkers();
  state.runtime.locationMarkers = {};

  const today = util.todayStrYYYYMMDD();

  for (const ev of list || []) {
    if ((ev.date || "").slice(0, 10) !== today) continue;

    const active = state.logic.activeCategory;
    if (active && active !== "all" && ev.category !== active) continue;

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

        if (state.logic.isLoggedIn) prepareEventCreation(lat, lng);

        App.renderAll?.({ rebuildMarkers: false });
      });
    }

    state.runtime.locationMarkers[key].events.push(ev);
  }

  Object.values(state.runtime.locationMarkers).forEach((loc) => {
    const html = App.map?.buildPlacePopupHTML?.(loc) || "";

    loc.marker.bindPopup(html, {
      closeButton: true,
      autoPan: true,
      keepInView: true,
      autoPanPadding: [16, 16],
      offset: [0, -10],
      maxWidth: 260,
      minWidth: 180
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

          openMarkerPopupStable(marker, lat, lng, 17);
          return;
        }

        if (btn.classList.contains("popupRouteBtn")) {
          const toLat = Number(btn.dataset.lat);
          const toLng = Number(btn.dataset.lng);

          const fromLat = state.logic.nearbyCenter?.lat;
          const fromLng = state.logic.nearbyCenter?.lng;

          if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
            alert("Primero marcá tu ubicación o usá “Eventos cerca mío”.");
            return;
          }

          if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) {
            alert("No se pudo resolver el destino.");
            return;
          }

          const url =
            `https://www.google.com/maps/dir/?api=1` +
            `&origin=${encodeURIComponent(`${fromLat},${fromLng}`)}` +
            `&destination=${encodeURIComponent(`${toLat},${toLng}`)}` +
            `&travelmode=walking`;

          window.open(url, "_blank", "noopener");
          return;
        }

        if (btn.classList.contains("popupShareBtn")) {
          const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
          if (!eventId) return;

          const title = decodeURIComponent((btn.dataset.title || "").trim());
          const url = `${location.origin}${location.pathname}#e=${encodeURIComponent(eventId)}`;
          const shareText = title ? `Evento: ${title}\n${url}` : url;

          if (navigator.share) {
            try {
              await navigator.share({
                title: title || "Evento",
                text: shareText,
                url
              });
              return;
            } catch {}
          }

          try {
            await navigator.clipboard.writeText(shareText);
            const prev = btn.textContent;
            btn.textContent = "Link copiado ✅";
            setTimeout(() => {
              btn.textContent = prev || "Compartir";
            }, 1200);
          } catch {
            window.prompt("Copiá este link:", shareText);
          }

          return;
        }

        if (btn.classList.contains("popupEditBtn")) {
  const eventId = decodeURIComponent((btn.dataset.editEid || "").trim());
  if (!eventId) return;

  const evData = App.events?.findEventById?.(eventId);
  if (!evData) {
    alert("No se encontró el evento.");
    return;
  }

  App.actions?.startEditingEvent?.(eventId);
  App.actions?.selectCategory?.("all");

  const titleEl = document.getElementById("eventTitle");
  const dateEl = document.getElementById("eventDate");
  const latEl = document.getElementById("eventLat");
  const lngEl = document.getElementById("eventLng");
  const placeEl = document.getElementById("eventPlace");
  const startEl = document.getElementById("eventStart");
  const catEl = document.getElementById("eventCategory");
  const addBtn = document.getElementById("addEventBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (titleEl) titleEl.value = evData.title || "";
  if (dateEl) dateEl.value = evData.date || "";
  if (latEl) latEl.value = Number(evData.lat).toFixed(6);
  if (lngEl) lngEl.value = Number(evData.lng).toFixed(6);
  if (placeEl) placeEl.value = evData.placeName || "";
  if (startEl) startEl.value = evData.startTime || "";
  if (catEl) catEl.value = evData.category || "music";

  const adminRow = document.getElementById("adminCategoryChips");
  if (adminRow) {
    const chips = [...adminRow.querySelectorAll(".chip[data-cat]")];
    chips.forEach((b) =>
      b.classList.toggle("isActive", b.dataset.cat === (evData.category || "music"))
    );
  }

  if (addBtn) addBtn.textContent = "Guardar cambios";
  if (cancelBtn) cancelBtn.hidden = false;

  if (state.runtime.map) {
    prepareEventCreation(evData.lat, evData.lng);
    uiSetView(evData.lat, evData.lng, 15);
  }

  const adminView = document.getElementById("adminView");
  if (adminView) adminView.hidden = false;

  const titleTarget = document.getElementById("eventTitle");
  if (titleTarget) {
    titleTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    titleTarget.focus();
  }

  return;
}

       if (btn.classList.contains("popupDeleteBtn")) {
  const eventId = decodeURIComponent((btn.dataset.deleteEid || "").trim());
  if (!eventId) return;

  const title = decodeURIComponent((btn.dataset.deleteTitle || "").trim());
  const msg = title
    ? `¿Seguro que querés borrar "${title}"?`
    : "¿Seguro que querés borrar este evento?";

  if (!confirm(msg)) return;

  const result = await App.events?.removeEvent?.(eventId);
  if (!result?.ok) {
    alert("No se pudo borrar el evento.");
    return;
  }

  if (state.logic.editingEventId === eventId) {
    App.actions?.stopEditingEvent?.();
  }

  if (
    state.runtime.deepLinkLayer &&
    typeof state.runtime.deepLinkLayer.clearLayers === "function"
  ) {
    state.runtime.deepLinkLayer.clearLayers();
  }

  App.commit?.({
    persist: true,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });
  return;
}

        if (btn.classList.contains("popupAddBtn")) {
          const lat = Number(btn.dataset.lat);
          const lng = Number(btn.dataset.lng);
          const place = decodeURIComponent(btn.dataset.place || "");

          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.runtime.map) return;

          setUserLocation(lat, lng);
          recomputeNearbyEvents(lat, lng);
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

  function normalizePlaceText(s) {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function findCanonicalPlace(placeName, lat, lng) {
    const targetName = normalizePlaceText(util.shortPlaceName(placeName));
    const all = state.logic.events || [];

    if (!util.isValidCoord(lat) || !util.isValidCoord(lng)) return null;
    if (!targetName) return null;

    let best = null;

    for (const ev of all) {
      if (!ev || !util.isValidCoord(ev.lat) || !util.isValidCoord(ev.lng)) continue;

      const evName = normalizePlaceText(util.shortPlaceName(ev.placeName));
      const dist = util.distanceKm(lat, lng, ev.lat, ev.lng);

      const sameName = !!evName && targetName === evName;
      const nearAndSameName = sameName && dist <= 0.12; // 120 m

      if (!nearAndSameName) continue;

      if (!best || dist < best.dist) {
        best = {
          lat: ev.lat,
          lng: ev.lng,
          placeName: ev.placeName || placeName,
          dist
        };
      }
    }

    return best;
  }

  /* =========================
     ADMIN EVENTS
  ========================= */
async function createEventFromAdminForm() {
  const titleEl = document.getElementById("eventTitle");
  const dateEl = document.getElementById("eventDate");
  const latEl = document.getElementById("eventLat");
  const lngEl = document.getElementById("eventLng");
  const placeEl = document.getElementById("eventPlace");
  const startEl = document.getElementById("eventStart");
  const catEl = document.getElementById("eventCategory");
  const addBtn = document.getElementById("addEventBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (!titleEl || !dateEl || !latEl || !lngEl) return;

  const title = titleEl.value.trim();
  const date = dateEl.value.trim();
  let lat = Number(latEl.value);
  let lng = Number(lngEl.value);
  let placeName = placeEl ? placeEl.value.trim() : "";
  const startTime = startEl ? startEl.value.trim() : "";
  const category = catEl ? catEl.value : "music";

  const canonical = findCanonicalPlace(placeName, lat, lng);
  if (canonical) {
    lat = canonical.lat;
    lng = canonical.lng;
    placeName = canonical.placeName;

    if (latEl) latEl.value = Number(lat).toFixed(6);
    if (lngEl) lngEl.value = Number(lng).toFixed(6);
    if (placeEl) placeEl.value = util.shortPlaceName(placeName);
  }

  const patch = {
    title,
    date,
    lat,
    lng,
    placeName,
    startTime,
    category
  };

  const editingId = String(state.logic.editingEventId || "").trim() || null;

  if (editingId) {
  const result = await App.events?.replaceEvent?.(editingId, patch);

  if (!result?.ok) {
    alert("No se pudo guardar la edición.");
    return;
  }

  App.actions?.stopEditingEvent?.();
} else {
    const rawEvent = {
      id: util.newId(),
      ...patch
    };

    const result = await App.events?.addEventRemote?.(rawEvent);

    if (!result?.ok) {
      alert("No se pudo guardar el evento.");
      return;
    }
  }

  titleEl.value = "";
  dateEl.value = "";
  latEl.value = "";
  lngEl.value = "";
  if (placeEl) placeEl.value = "";
  if (startEl) startEl.value = "";
  if (catEl) catEl.value = "music";

  const adminRow = document.getElementById("adminCategoryChips");
  if (adminRow) {
    const chips = [...adminRow.querySelectorAll(".chip[data-cat]")];
    chips.forEach((b) => b.classList.toggle("isActive", b.dataset.cat === "music"));
  }

  if (addBtn) addBtn.textContent = "Agregar evento";
  if (cancelBtn) cancelBtn.hidden = true;

  clearEventCreationMarker();

  App.commit?.({
    persist: true,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });
}
  /* =========================
     GEOLOCATION + INPUT SEARCH
  ========================= */
  function useMyLocation() {
  if (!navigator.geolocation) {
    alert("Tu navegador no soporta geolocalización.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setUserLocation(lat, lng);
      recomputeNearbyEvents(lat, lng);
      uiSetView(lat, lng, 15);

      if (state.logic.isLoggedIn) prepareEventCreation(lat, lng);

      App.renderAll?.({ rebuildMarkers: false });
    },
    (err) => {
      alert("No se pudo obtener la ubicación: " + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
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

  /* =========================
     MAP INIT
  ========================= */
  function initMap(lat, lng) {
  state.runtime.map = L.map("map").setView([lat, lng], 15);
  state.runtime.map.doubleClickZoom.disable();

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(state.runtime.map);

  state.runtime.markerCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 16
  });

  state.runtime.map.addLayer(state.runtime.markerCluster);
  state.runtime.deepLinkLayer = L.layerGroup().addTo(state.runtime.map);

  state.runtime.map.on("click", (e) => {
    const t = e.originalEvent?.target;
    if (t && (t.closest?.(".leaflet-marker-icon") || t.closest?.(".leaflet-popup"))) return;

    const clat = e.latlng.lat;
    const clng = e.latlng.lng;

    setUserLocation(clat, clng);
    recomputeNearbyEvents(clat, clng);
    uiSetView(clat, clng, 15);

    App.renderAll?.({ rebuildMarkers: false });
  });

  state.runtime.map.on("dragstart", () => {
    if (state.runtime.uiPanZoomInProgress) return;
    state.runtime.map.closePopup();
  });

  state.runtime.map.on("zoomstart", () => {
    if (state.runtime.uiPanZoomInProgress) return;
    state.runtime.map.closePopup();
  });
}

  /* =========================
     LISTENER: Ver en mapa
  ========================= */
  document.addEventListener("click", (e) => {
  const linkBtn = e.target.closest(".linkBtn[data-lat][data-lng]");
  if (!linkBtn) return;

  e.preventDefault();
  e.stopPropagation();

  const lat = parseFloat(linkBtn.dataset.lat);
  const lng = parseFloat(linkBtn.dataset.lng);
  const key = linkBtn.dataset.key || util.locationKey(lat, lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.runtime.map) return;

  const mapEl = document.getElementById("map");
  if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

  state.runtime.map.closePopup();

  let loc = state.runtime.locationMarkers?.[key];

  if (!loc) {
    rebuildLocationMarkers(state.logic.events);
    loc = state.runtime.locationMarkers?.[key];
  }

  const targetZoom = Math.max(state.runtime.map.getZoom(), 16);

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
});

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

        if (state.logic.isLoggedIn) prepareEventCreation(lat, lng);

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
    openMarkerPopupStable(loc.marker, ev.lat, ev.lng, 17);
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
    autoPan: true,
    keepInView: true,
    autoPanPadding: [16, 16],
    offset: [0, -10],
    maxWidth: 260,
    minWidth: 180
  });

  if (state.runtime.deepLinkLayer) {
    m.addTo(state.runtime.deepLinkLayer);
  } else {
    m.addTo(state.runtime.map);
  }

  openMarkerPopupStable(m, ev.lat, ev.lng, 17);

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

  /* =========================
     EXPORT MAP MODULE
  ========================= */
  App.map = {
    ...(App.map || {}),
    initMap,
    rebuildLocationMarkers,
    renderMap,
    recomputeNearbyEvents,
    filterEventsByDistance,
    setUserLocation,
    prepareEventCreation,
    clearEventCreationMarker,
    useMyLocation,
    searchNearbyFromInputs,
    bindAdminCategoryChips,
    bindPlaceSearchUI,
    createEventFromAdminForm,
    focusEventById,
    clearAllEvents
  };

  App.map.bindPlaceSearchUI();
})();