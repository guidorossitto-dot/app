// map-places.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state, storage } = App;

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
    if (!state.map) return;

    state._uiPanZoomInProgress = true;
    try {
      state.map.setView([lat, lng], zoom, { animate: true });
    } finally {
      setTimeout(() => (state._uiPanZoomInProgress = false), 250);
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
    if (state.markerCluster) state.markerCluster.clearLayers();
  }

  function highlightNearbyMarkers(filteredEvents) {
    const nearbyKeys = new Set((filteredEvents || []).map((ev) => util.locationKey(ev.lat, ev.lng)));

    Object.entries(state.locationMarkers || {}).forEach(([key, loc]) => {
      const isNear = nearbyKeys.has(key);
      if (loc?.marker?.setOpacity) loc.marker.setOpacity(isNear ? 1 : 0.35);
    });
  }

  /* =========================
     REBUILD LOCATION MARKERS
  ========================= */
  function rebuildLocationMarkers(list = state.events) {
    if (!state.map || !state.markerCluster) return;

    clearEventMarkers();
    state.locationMarkers = {};

    const today = util.todayStrYYYYMMDD();

    for (const ev of list || []) {
      if ((ev.date || "").slice(0, 10) !== today) continue;

      const active = state.activeCategory;
      if (active && active !== "all" && ev.category !== active) continue;

      if (!util.isValidCoord(ev.lat) || !util.isValidCoord(ev.lng)) continue;

      const key = util.locationKey(ev.lat, ev.lng);

      if (!state.locationMarkers[key]) {
        const marker = L.marker([ev.lat, ev.lng], {
          bubblingMouseEvents: false,
          icon: getCategoryIcon(ev.category || "music")
        });

        state.markerCluster.addLayer(marker);
        state.locationMarkers[key] = { marker, events: [], lat: ev.lat, lng: ev.lng };

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

          const { lat, lng } = state.locationMarkers[key];

          setUserLocation(lat, lng);
          recomputeNearbyEvents(lat, lng);
          state.map.setView([lat, lng], 15);
          marker.openPopup();

          if (state.isLoggedIn) prepareEventCreation(lat, lng);

          App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
        });
      }

      state.locationMarkers[key].events.push(ev);
    }

    Object.values(state.locationMarkers).forEach((loc) => {
      const placeNameFull =
        (loc.events.find((e) => (e.placeName || "").trim())?.placeName || "").trim();
      const placeName = util.shortPlaceName(placeNameFull);
      const placeTitle = placeName ? placeName : "Eventos en este punto";

      const sorted = [...loc.events].sort(util.sortEventsByStatusThenTime);
      const total = sorted.length;

      const actionBtn = state.isLoggedIn
        ? `<button class="popupBtn popupBtnPrimary popupAddBtn"
              data-lat="${loc.lat}"
              data-lng="${loc.lng}"
              data-place="${encodeURIComponent(placeName || "")}">
            Cargar evento acá
          </button>`
        : "";

      const centerBtn = `
        <button class="popupBtn popupCenterBtn"
          data-lat="${loc.lat}"
          data-lng="${loc.lng}">
          Centrar
        </button>
      `;

      let html = `
        <div class="popupCard">
          <div class="popupHeader">
            <div>
              <div class="popupPlace">${placeTitle}</div>
              <div class="popupSub">${total} ${total === 1 ? "evento" : "eventos"} hoy</div>
            </div>
          </div>

          <div class="popupActions">
            ${centerBtn}
            ${actionBtn}
          </div>

          <div class="popupList">
      `;

      for (const e of sorted) {
        const st = util.formatTimeStart(e);
        const status = util.getEventStatus(e);
        const eid = e.id != null ? String(e.id) : "";

        html += `
          <div class="popupItem" ${eid ? `data-eid="${encodeURIComponent(eid)}"` : ""}>
            <div class="popupItemTitle" style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
              <div style="min-width:0;">
                ${st ? `<span style="opacity:.75;margin-right:6px">${st}</span>` : ""}
                <span style="word-break:break-word;">${e.title}${categoryTagHTML(e)}</span>
                ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
              </div>

              ${eid ? `
                <button class="popupBtn popupShareBtn"
                  data-eid="${encodeURIComponent(eid)}"
                  data-title="${encodeURIComponent(e.title || "")}"
                  title="Copiar link de este evento">
                  Compartir
                </button>
              ` : ""}
            </div>

            <div class="popupItemMeta">${util.formatDateDisplay(e.date)}</div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;

      loc.marker.bindPopup(html, {
        closeButton: true,
        autoPan: true,
        keepInView: true,
        autoPanPadding: [30, 30],
        offset: [0, -10]
      });

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
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.map) return;

            const targetZoom = Math.max(state.map.getZoom(), 17);

            if (state.markerCluster && typeof state.markerCluster.zoomToShowLayer === "function") {
              state.markerCluster.zoomToShowLayer(loc.marker, () => {
                state.map.setView([lat, lng], targetZoom, { animate: true });
                loc.marker.openPopup();
              });
            } else {
              state.map.setView([lat, lng], targetZoom, { animate: true });
              loc.marker.openPopup();
            }
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
              setTimeout(() => (btn.textContent = prev || "Compartir"), 1200);
            } catch {
              window.prompt("Copiá este link:", shareText);
            }

            return;
          }

          if (btn.classList.contains("popupAddBtn")) {
            const lat = Number(btn.dataset.lat);
            const lng = Number(btn.dataset.lng);
            const place = decodeURIComponent(btn.dataset.place || "");

            if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.map) return;

            setUserLocation(lat, lng);
            recomputeNearbyEvents(lat, lng);
            state.map.setView([lat, lng], 15);

            prepareEventCreation(lat, lng);

            const placeEl = document.getElementById("eventPlace");
            if (placeEl && place && !placeEl.value.trim()) placeEl.value = place;

            const titleEl = document.getElementById("eventTitle");
            if (titleEl) titleEl.focus();

            App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
          }
        };

        root.addEventListener("click", onClick, true);

        const pending = state._pendingOpenEventId;
        if (pending) {
          const sel = `[data-eid="${encodeURIComponent(String(pending))}"]`;
          const row = root.querySelector(sel);

          if (row) {
            row.classList.add("popupItemHighlight");
            row.scrollIntoView({ block: "center", behavior: "smooth" });
            setTimeout(() => row.classList.remove("popupItemHighlight"), 1600);
          }

          state._pendingOpenEventId = null;
        }
      });

      loc.marker.setOpacity(1);
    });
  }

  /* =========================
     NEARBY STATE
  ========================= */
  function recomputeNearbyEvents(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      state.nearbyCenter = null;
      state.nearbyEvents = [];
      return [];
    }

    state.nearbyCenter = { lat, lng };
    state.nearbyEvents = util.getNearbyTodayEvents(lat, lng, state.events);
    return state.nearbyEvents;
  }

  function filterEventsByDistance(lat, lng) {
    const filtered = recomputeNearbyEvents(lat, lng);
    App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
    return filtered;
  }

  function renderMap(opts = {}) {
    const { rebuildMarkers = true } = opts;

    if (rebuildMarkers) {
      rebuildLocationMarkers(state.events);
    }

    highlightNearbyMarkers(state.nearbyEvents || []);
  }

  /* =========================
     USER LOCATION + EVENT CREATION
  ========================= */
  function setUserLocation(lat, lng) {
    if (!state.map) return;

    setUserInputs(lat, lng);

    if (state.userMarker) {
      state.userMarker.setLatLng([lat, lng]);
    } else {
      state.userMarker = L.marker([lat, lng], { draggable: true }).addTo(state.map);

      state.userMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        setUserInputs(pos.lat, pos.lng);
        recomputeNearbyEvents(pos.lat, pos.lng);
        App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
      });
    }
  }

  function prepareEventCreation(lat, lng) {
    const eLat = document.getElementById("eventLat");
    const eLng = document.getElementById("eventLng");
    if (eLat) eLat.value = Number(lat).toFixed(6);
    if (eLng) eLng.value = Number(lng).toFixed(6);

    if (!state.map) return;

    if (state.eventCreationMarker) {
      state.eventCreationMarker.setLatLng([lat, lng]);
    } else {
      state.eventCreationMarker = L.marker([lat, lng], { draggable: true }).addTo(state.map);

      state.eventCreationMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        const eLat2 = document.getElementById("eventLat");
        const eLng2 = document.getElementById("eventLng");
        if (eLat2) eLat2.value = pos.lat.toFixed(6);
        if (eLng2) eLng2.value = pos.lng.toFixed(6);
      });
    }
  }

  function clearEventCreationMarker() {
    if (state.eventCreationMarker) {
      state.eventCreationMarker.remove();
      state.eventCreationMarker = null;
    }
  }

  /* =========================
     ADMIN EVENTS
  ========================= */
  function createEventFromAdminForm() {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");

    if (!titleEl || !dateEl || !latEl || !lngEl) return;

    const rawEvent = {
      id: util.newId(),
      title: titleEl.value.trim(),
      date: dateEl.value.trim(),
      lat: Number(latEl.value),
      lng: Number(lngEl.value),
      placeName: placeEl ? placeEl.value.trim() : "",
      startTime: startEl ? startEl.value.trim() : "",
      category: catEl ? catEl.value : "music"
    };

    const ev = util.normalizeEvent(rawEvent);

    if (!util.isValidEvent(ev)) {
      alert("Completá título, fecha y coordenadas válidas.");
      return;
    }

    state.events.push(ev);

    titleEl.value = "";
    if (startEl) startEl.value = "";

    if (state.nearbyCenter) {
      recomputeNearbyEvents(state.nearbyCenter.lat, state.nearbyCenter.lng);
    }

    storage.saveEvents();
    App.ui.commit({ rebuildMarkers: true, recomputeNearby: false });
  }

  function clearAllEvents() {
    if (!confirm("¿Seguro que querés borrar todos los eventos?")) return;

    state.events = [];
    state.nearbyEvents = [];

    storage.saveEvents();
    App.ui.commit({ rebuildMarkers: true, recomputeNearby: false });
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
        state.map.setView([lat, lng], 15);

        if (state.isLoggedIn) prepareEventCreation(lat, lng);

        App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
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
    state.map.setView([lat, lng], 15);

    App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
  }

  /* =========================
     MAP INIT
  ========================= */
  function initMap(lat, lng) {
    state.map = L.map("map").setView([lat, lng], 15);
    state.map.doubleClickZoom.disable();

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(state.map);

    state.markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16
    });

    state.map.addLayer(state.markerCluster);
    state.deepLinkLayer = L.layerGroup().addTo(state.map);

    state.map.on("click", (e) => {
      const t = e.originalEvent?.target;
      if (t && (t.closest?.(".leaflet-marker-icon") || t.closest?.(".leaflet-popup"))) return;

      const clat = e.latlng.lat;
      const clng = e.latlng.lng;

      setUserLocation(clat, clng);
      recomputeNearbyEvents(clat, clng);
      state.map.setView([clat, clng], 15);

      if (state.isLoggedIn) prepareEventCreation(clat, clng);

      App.ui?.renderAll?.({ rebuildMarkers: false, recomputeNearby: false });
    });

    state.map.on("dragstart", () => {
      if (state._uiPanZoomInProgress) return;
      state.map.closePopup();
    });

    state.map.on("zoomstart", () => {
      if (state._uiPanZoomInProgress) return;
      state.map.closePopup();
    });
  }

  /* =========================
     LISTENER: Ver en mapa
  ========================= */
  document.addEventListener("click", (e) => {
    const linkBtn = e.target.closest(".linkBtn");
    if (!linkBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const lat = parseFloat(linkBtn.dataset.lat);
    const lng = parseFloat(linkBtn.dataset.lng);
    const key = linkBtn.dataset.key || util.locationKey(lat, lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.map) return;

    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

    state.map.closePopup();

    rebuildLocationMarkers(state.events);

    const loc = state.locationMarkers?.[key];
    const targetZoom = Math.max(state.map.getZoom(), 16);

    uiSetView(lat, lng, targetZoom);

    if (loc?.marker) {
      if (state.markerCluster && typeof state.markerCluster.zoomToShowLayer === "function") {
        state.markerCluster.zoomToShowLayer(loc.marker, () => {
          uiSetView(lat, lng, Math.max(targetZoom, 17));
          loc.marker.openPopup();
          glowMarker(loc.marker);
        });
      } else {
        loc.marker.openPopup();
        glowMarker(loc.marker);
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

        if (state.map) state.map.closePopup();

        if (state.map && Number.isFinite(lat) && Number.isFinite(lng)) {
          state.map.setView([lat, lng], 16);
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

        if (state.isLoggedIn) prepareEventCreation(lat, lng);

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

    const ev = (state.events || []).find((e) => String(e.id) === id);
    if (!ev || !state.map) return false;

    if (state.deepLinkLayer && typeof state.deepLinkLayer.clearLayers === "function") {
      state.deepLinkLayer.clearLayers();
    }

    const key = util.locationKey(ev.lat, ev.lng);
    const loc = state.locationMarkers?.[key];

    if (loc?.marker) {
      state._pendingOpenEventId = id;

      const targetZoom = Math.max(state.map.getZoom(), 17);

      if (state.markerCluster && typeof state.markerCluster.zoomToShowLayer === "function") {
        state.markerCluster.zoomToShowLayer(loc.marker, () => {
          state.map.setView([ev.lat, ev.lng], targetZoom, { animate: true });
          loc.marker.openPopup();
        });
      } else {
        state.map.setView([ev.lat, ev.lng], targetZoom, { animate: true });
        loc.marker.openPopup();
      }
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
      autoPanPadding: [30, 30],
      offset: [0, -10]
    });

    if (state.deepLinkLayer) m.addTo(state.deepLinkLayer);
    else m.addTo(state.map);

    const targetZoom = Math.max(state.map.getZoom(), 17);
    state.map.setView([ev.lat, ev.lng], targetZoom, { animate: true });
    m.openPopup();

    setTimeout(() => {
      const el = m.getElement?.();
      if (el) {
        el.classList.add("marker-highlight");
        setTimeout(() => el.classList.remove("marker-highlight"), 900);
      }
    }, 50);

    return true;
  }

  /* =========================
     EXPORT MAP MODULE
  ========================= */
  App.map = {
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
  App.ui.bootAfterMapReady();
})();