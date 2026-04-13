// actions.js
(() => {
  "use strict";

  const App = window.App;

  /* =========================
     SESSION
  ========================= */
 function setLogin(isLoggedIn) {
  return App.events?.setLoginState?.(isLoggedIn);
}

async function login() {
  return await App.auth?.login?.();
}

async function logout() {
  return await App.auth?.logout?.();
}
  /* =========================
     LOGIC STATE
  ========================= */
function selectCategory(category) {
  return App.events?.setActiveCategory?.(category);
}

  function setCalendarMonth(date) {
  return App.events?.setCalendarCursor?.(date);
}

  function startEditingEvent(eventId) {
  return App.events?.setEditingEventId?.(eventId);
}

  function stopEditingEvent() {
  return App.events?.setEditingEventId?.(null);
}

function setEditingMode(mode) {
  return App.events?.setEditingMode?.(mode);
}

function setEditingSeriesId(seriesId) {
  return App.events?.setEditingSeriesId?.(seriesId);
}

  function setNearbyCenter(center) {
    return App.events?.setNearbyCenter?.(center);
  }

  function setNearbyEvents(list) {
    return App.events?.setNearbyEvents?.(list);
  }

  function queueCalendarDate(dateStr) {
  return App.events?.setPendingCalendarDate?.(dateStr);
}

function clearQueuedCalendarDate() {
  return App.events?.clearPendingCalendarDate?.();
}

  /* =========================
     RUNTIME
  ========================= */
  function queueDeepLink(eventId) {
  return App.events?.setPendingDeepLinkEventId?.(eventId);
}

  function clearQueuedDeepLink() {
  return App.events?.clearPendingDeepLinkEventId?.();
} 

  function highlightPendingPopupEvent(eventId) {
  return App.events?.setPendingOpenEventId?.(eventId);
}

 function clearPendingPopupEvent() {
  return App.events?.clearPendingOpenEventId?.();
}

  function setBootReady(flag) {
  return App.events?.setBootReady?.(flag);
}

  /* =========================
     INFRA / TRANSITION
  ========================= */
  function commitAndRender(opts = {}) {
  return App.events?.commit?.(opts);
}

  function saveAndRefresh(opts = {}) {
  return App.events?.saveAndRefresh?.(opts);
}

async function deleteEventFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  if (!App.util?.canManageUI?.()) {
    alert("No tenés permisos para borrar eventos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const eventId = decodeURIComponent(
    (btn.dataset.deleteEid || btn.dataset.eid || btn.dataset.id || "").trim()
  );

  if (!eventId) {
    return { ok: false, error: "MISSING_ID" };
  }

  const ev = App.events?.findEventById?.(eventId) || null;
  if (!ev) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const title = decodeURIComponent(
    (btn.dataset.deleteTitle || btn.dataset.title || ev.title || "").trim()
  );

  const seriesId = String(ev.seriesId || "").trim();
  const isRecurring = !!seriesId;

  let result = null;

  if (isRecurring) {
    const choice = window.prompt(
      `El evento "${title || "sin título"}" pertenece a una serie.\n\n` +
      `Escribí:\n` +
      `1 = borrar solo este evento\n` +
      `2 = borrar toda la serie`
    );

    if (choice === null) {
      return { ok: false, error: "CANCELLED" };
    }

    const normalizedChoice = String(choice).trim();

    if (normalizedChoice === "2") {
      const confirmSeries = confirm("¿Seguro que querés borrar toda la serie?");
      if (!confirmSeries) {
        return { ok: false, error: "CANCELLED" };
      }

      result = await App.events?.removeSeries?.(seriesId);

      if (!result?.ok) {
        alert("No se pudo borrar la serie.");
        return { ok: false, error: result?.error || "DELETE_SERIES_FAILED" };
      }
    } else if (normalizedChoice === "1") {
      const confirmSingle = confirm("¿Seguro que querés borrar solo este evento?");
      if (!confirmSingle) {
        return { ok: false, error: "CANCELLED" };
      }

      result = await App.events?.removeEvent?.(eventId);

      if (!result?.ok) {
        alert("No se pudo borrar el evento.");
        return { ok: false, error: result?.error || "DELETE_FAILED" };
      }
    } else {
      alert("Opción no válida. Escribí 1 o 2.");
      return { ok: false, error: "INVALID_CHOICE" };
    }
  } else {
    const msg = title
      ? `¿Seguro que querés borrar "${title}"?`
      : "¿Seguro que querés borrar este evento?";

    if (!confirm(msg)) {
      return { ok: false, error: "CANCELLED" };
    }

    result = await App.events?.removeEvent?.(eventId);

    if (!result?.ok) {
      alert("No se pudo borrar el evento.");
      return { ok: false, error: result?.error || "DELETE_FAILED" };
    }
  }

  if (App.state.logic.editingEventId === eventId) {
    App.actions?.stopEditingEvent?.();
    App.actions?.setEditingMode?.(null);
    App.actions?.setEditingSeriesId?.(null);
  }

  if (App.state.runtime.map) {
    App.state.runtime.map.closePopup();
  }
  

  App.commit?.({
    persist: false,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });

  return { ok: true, eventId, recurring: isRecurring };
}

function toggleFavorite(eventId) {
  return App.events?.toggleFavorite?.(eventId);
}

async function shareEventFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
  const customUrl = String(btn.dataset.url || "").trim();

  if (!eventId && !customUrl) {
    return { ok: false, error: "MISSING_ID_AND_URL" };
  }

  const ev = eventId ? (App.events?.findEventById?.(eventId) || null) : null;

  const title = (
    ev?.title ||
    decodeURIComponent((btn.dataset.title || "").trim()) ||
    "Evento"
  ).trim();

  const place = (
    App.util?.shortPlaceName?.(ev?.placeName) ||
    decodeURIComponent((btn.dataset.place || "").trim()) ||
    ""
  ).trim();

  const date = (
    App.util?.formatDateDisplay?.(ev?.date) ||
    decodeURIComponent((btn.dataset.date || "").trim()) ||
    ""
  ).trim();

  const time = (
    App.util?.formatTimeStart?.(ev) ||
    decodeURIComponent((btn.dataset.time || "").trim()) ||
    ""
  ).trim();

  const url =
    customUrl ||
    `${location.origin}${location.pathname}#e=${encodeURIComponent(eventId)}`;

  const lines = [
    title ? `Evento: ${title}` : "Evento",
    place ? `📍 ${place}` : "",
    (date || time) ? `🗓️ ${date}${time ? ` · ${time}` : ""}` : ""
  ].filter(Boolean);

  const shareText = lines.join("\n");
  const fallbackText = `${shareText}\n\n🔗 ${url}`;

  if (typeof gtag === "function") {
    gtag("event", "share_event", {
      event_id: eventId || "unknown"
    });
  }

  // Mantener share nativo intacto para no romper WhatsApp / apps del sistema
  if (navigator.share) {
  try {
    await navigator.share({
      title,
      text: `${shareText}\n\n🔗 ${url}`
    });
    return { ok: true, mode: "native" };
  } catch {}
}

  // Solo mejoramos el fallback
  try {
  await navigator.clipboard.writeText(`${shareText}\n\n🔗 ${url}`);
  const prev = btn.textContent;
  btn.textContent = "Link copiado ✅";
  setTimeout(() => {
    btn.textContent = prev || "Compartir";
  }, 1200);
  return { ok: true, mode: "clipboard" };
} catch {
  window.prompt("Copiá este link:", `${shareText}\n\n🔗 ${url}`);
  return { ok: true, mode: "prompt" };
}
}

function setFavoritesOnly(value) {
  return App.events?.setFavoritesOnly?.(value);
}

function toggleFavoritesOnly() {
  return App.events?.setFavoritesOnly?.(!App.events?.getFavoritesOnly?.());
}

function routeToEventFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  const toLat = Number(btn.dataset.lat);
  const toLng = Number(btn.dataset.lng);

  const fromLat = App.state.logic.nearbyCenter?.lat;
  const fromLng = App.state.logic.nearbyCenter?.lng;

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    alert("Primero marcá tu ubicación o usá “Eventos cerca mío”.");
    return { ok: false, error: "MISSING_ORIGIN" };
  }

  if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) {
    alert("No se pudo resolver el destino.");
    return { ok: false, error: "INVALID_DESTINATION" };
  }

  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(`${fromLat},${fromLng}`)}` +
    `&destination=${encodeURIComponent(`${toLat},${toLng}`)}` +
    `&travelmode=walking`;

  window.open(url, "_blank", "noopener");

  return {
    ok: true,
    mode: "walking",
    origin: { lat: fromLat, lng: fromLng },
    destination: { lat: toLat, lng: toLng }
  };
}

function focusEventOnMapFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
  const lat = Number(btn.dataset.lat);
  const lng = Number(btn.dataset.lng);
  const key = btn.dataset.key || "";

  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (eventId && App.map?.focusEventById) {
  const ok = App.map.focusEventById(eventId);

  return ok
    ? { ok: true, mode: "event", eventId }
    : { ok: false, error: "EVENT_NOT_FOUND", eventId };
}

  const loc = key ? App.state.runtime.locationMarkers?.[key] : null;

  if (App.state.runtime.map && Number.isFinite(lat) && Number.isFinite(lng)) {
    App.state.runtime.map.setView([lat, lng], 16);
    if (loc?.marker) loc.marker.openPopup();
    return {
      ok: true,
      mode: "coords",
      lat,
      lng
    };
  }

  return { ok: false, error: "FOCUS_FAILED" };
}

function focusPlaceOnMapFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  const lat = Number(btn.dataset.lat);
  const lng = Number(btn.dataset.lng);
  const key = btn.dataset.key || "";

  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!App.state.runtime.map || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "INVALID_COORDS" };
  }

  let eventIds = [];
  try {
    eventIds = JSON.parse(decodeURIComponent(btn.dataset.eventIds || "[]"));
  } catch {
    eventIds = [];
  }

  const allEvents = Array.isArray(App.state.logic.events) ? App.state.logic.events : [];

  let selectedEvents = [];
  if (eventIds.length) {
    const wanted = new Set(eventIds.map(String));
    selectedEvents = allEvents.filter((ev) => wanted.has(String(ev.id)));
  }

  if (!selectedEvents.length && key) {
    selectedEvents = allEvents.filter((ev) => {
      try {
        return App.util.smartLocationKey(ev) === key;
      } catch {
        return false;
      }
    });
  }

  const placeTitle =
    btn.closest("li, .accordion, .panelCard, .featuredBox")
      ?.querySelector("[data-place-title]")?.textContent?.trim()
    || "Lugar";

  const popupLoc = {
    lat,
    lng,
    events: selectedEvents
  };

  const popupHTML =
    selectedEvents.length && typeof App.map?.buildPlacePopupHTML === "function"
      ? App.map.buildPlacePopupHTML(popupLoc)
      : `
        <div class="popupCard">
          <div class="popupHeader">
            <div>
              <div class="popupPlace">${placeTitle}</div>
              <div class="popupSub">Ubicación del lugar</div>
            </div>
          </div>
        </div>
      `;

  const loc = key ? App.state.runtime.locationMarkers?.[key] : null;

  if (
    loc?.marker &&
    App.state.runtime.map
  ) {
    const p = loc.marker.getLatLng();

    try {
      if (typeof loc.marker.setPopupContent === "function") {
        loc.marker.setPopupContent(popupHTML);
      } else {
        loc.marker.bindPopup(popupHTML, {
          closeButton: true,
          autoPan: true,
          keepInView: true,
          autoPanPadding: [16, 16],
          offset: [0, -10],
          maxWidth: 260,
          minWidth: 180
        });
      }
    } catch {
      try {
        loc.marker.bindPopup(popupHTML, {
          closeButton: true,
          autoPan: true,
          keepInView: true,
          autoPanPadding: [16, 16],
          offset: [0, -10],
          maxWidth: 260,
          minWidth: 180
        });
      } catch {}
    }

    if (App.map?.openMarkerPopupStable) {
      App.map.openMarkerPopupStable(loc.marker, p.lat, p.lng, 16);
    } else {
      App.state.runtime.map.setView([p.lat, p.lng], 16);
      setTimeout(() => {
        try {
          loc.marker.openPopup();
        } catch {}
      }, 140);
    }

    return {
      ok: true,
      mode: "marker",
      lat: p.lat,
      lng: p.lng
    };
  }

  if (
    App.state.runtime.deepLinkLayer &&
    typeof App.state.runtime.deepLinkLayer.clearLayers === "function"
  ) {
    App.state.runtime.deepLinkLayer.clearLayers();
  }

  App.map?.clearTemporaryFocusMarker?.();

  const tempMarker = L.marker([lat, lng], {
    bubblingMouseEvents: false
  });

  App.map?.setTemporaryFocusMarker?.(tempMarker);

  tempMarker.bindPopup(popupHTML, {
    closeButton: true,
    autoPan: true,
    keepInView: true,
    autoPanPadding: [16, 16],
    offset: [0, -10],
    maxWidth: 260,
    minWidth: 180
  });

  tempMarker.on("popupclose", () => {
    if (App.state.runtime.temporaryFocusMarker === tempMarker) {
      App.map?.clearTemporaryFocusMarker?.();
    }
  });

  if (App.state.runtime.deepLinkLayer) {
    tempMarker.addTo(App.state.runtime.deepLinkLayer);
  } else {
    tempMarker.addTo(App.state.runtime.map);
  }

  App.state.runtime.map.setView([lat, lng], 16);

  setTimeout(() => {
    try {
      tempMarker.openPopup();
    } catch {}
  }, 120);

  return {
    ok: true,
    mode: "temporary-marker",
    lat,
    lng
  };
}

function queueDeepLinkFromHashFlow() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return { ok: false, error: "EMPTY_HASH" };

  const params = new URLSearchParams(h);
  const eventId = (params.get("e") || "").trim();
  if (!eventId) return { ok: false, error: "MISSING_EVENT_ID" };

  App.actions?.queueDeepLink?.(decodeURIComponent(eventId));
  return { ok: true, eventId: decodeURIComponent(eventId) };
}

async function approveEventCandidatesBulkFlow(candidateIds = []) {
  if (!App.util?.canManageUI?.()) {
    alert("No tenés permisos para aprobar candidatos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const ids = Array.isArray(candidateIds)
    ? candidateIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!ids.length) {
    return { ok: false, error: "EMPTY_CANDIDATE_IDS" };
  }

  const result = await App.candidates?.approveCandidates?.(ids);

  if (!result?.ok) {
    alert("No se pudieron aprobar los candidatos.");
    return { ok: false, error: result?.error || "APPROVE_BULK_FAILED" };
  }

  App.commit?.({
    persist: false,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });

  return {
    ok: true,
    approvedCount: result.approvedCount || 0
  };
}

async function approvePendingCandidatesBySourceFlow(sourceName = "") {
  if (!App.util?.canManageUI?.()) {
    alert("No tenés permisos para aprobar candidatos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const source = String(sourceName || "").trim();
  if (!source) {
    return { ok: false, error: "MISSING_SOURCE_NAME" };
  }

  const result = await App.candidates?.approvePendingCandidatesBySource?.(source);

  if (!result?.ok) {
    alert("No se pudieron aprobar los candidatos pendientes.");
    return { ok: false, error: result?.error || "APPROVE_PENDING_FAILED" };
  }

  App.commit?.({
    persist: false,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });

  return result;
}

async function importZibiliaCandidatesFlow() {
  if (!App.util?.canManageUI?.()) {
    alert("No tenés permisos para importar candidatos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const importer = App.zibiliaImport?.loadCandidates
    || App.zibiliaImport?.fetchCandidates
    || App.zibiliaImport?.run
    || App.zibiliaImport?.importCandidates;

  if (typeof importer !== "function") {
    alert("No encontré la función de importación de Zibilia.");
    return { ok: false, error: "ZIBILIA_IMPORTER_NOT_FOUND" };
  }

  const rawResult = await importer();

  const rawList = Array.isArray(rawResult)
    ? rawResult
    : Array.isArray(rawResult?.candidates)
      ? rawResult.candidates
      : Array.isArray(rawResult?.items)
        ? rawResult.items
        : [];

  if (!rawList.length) {
    return { ok: true, importedCount: 0, empty: true };
  }

  const normalized = rawList.map((item) =>
    App.candidateDedupe.ensureCandidateShape(item, "zibilia")
  );

  const merged = App.candidateDedupe.mergeRawCandidates(normalized);

  const saveResult = await App.storage?.insertEventCandidates?.(merged);

  if (!saveResult?.ok) {
    alert("No se pudieron guardar los candidatos de Zibilia.");
    return { ok: false, error: saveResult?.error || "INSERT_CANDIDATES_FAILED" };
  }

  return {
    ok: true,
    importedCount: saveResult.count || merged.length,
    candidates: saveResult.candidates || []
  };
}

function processQueuedDeepLinkFlow() {

 const h = (location.hash || "").replace(/^#/, "");
const params = new URLSearchParams(h);
const hasDate = !!(params.get("d") || "").trim();

if (hasDate) {
  return { ok: false, error: "CALENDAR_DEEP_LINK_TAKES_PRIORITY" };
}
  const eventId = App.state.runtime.pendingDeepLinkEventId;
  if (!eventId) return { ok: false, error: "NO_PENDING_DEEP_LINK" };

  const ev = App.events?.findEventById?.(eventId) || null;
  if (!ev) {
    App.actions?.clearQueuedDeepLink?.();
    if (App.ui?.clearListFocus) App.ui.clearListFocus();
    App.renderAll?.({
      rebuildMarkers: false,
      recomputeNearby: false
    });
    return { ok: false, error: "EVENT_NOT_FOUND" };
  }

  document.title = ev?.title ? `${ev.title} · Agenda de eventos` : "Agenda de eventos";

  let categoryReset = false;

  if (
    App.state.logic.activeCategory &&
    App.state.logic.activeCategory !== "all" &&
    App.state.logic.activeCategory !== ev.category
  ) {
    App.actions?.selectCategory?.("all");
    categoryReset = true;

    const row = document.getElementById("categoryChips");
    if (row) {
      const chips = [...row.querySelectorAll(".chip")];
      chips.forEach((btn) => btn.classList.toggle("isActive", btn.dataset.cat === "all"));
    }
  }

    App.map?.clearTemporaryFocusMarker?.();

  if (
    App.state.runtime.deepLinkLayer &&
    typeof App.state.runtime.deepLinkLayer.clearLayers === "function"
  ) {
    try {
      App.state.runtime.deepLinkLayer.clearLayers();
    } catch {}
  }

  if (App.ui?.setListFocus) {
    App.ui.setListFocus({ type: "event", eventId });
  }

  if (categoryReset) {
    App.commit?.({
      persist: false,
      purgePast: false,
      rebuildMarkers: true,
      recomputeNearby: true
    });
  } else {
    App.renderAll?.({
  rebuildMarkers: true,
  recomputeNearby: false
});

if (App.state.runtime.bootReady && App.map?.focusEventById) {
  setTimeout(() => {
    const tryFocus = () => App.map?.focusEventById?.(eventId);

    let ok = tryFocus();

    if (!ok) {
      setTimeout(() => {
        ok = tryFocus();
      }, 260);
    }

    if (!ok) {
      setTimeout(() => {
        App.renderAll?.({
          rebuildMarkers: true,
          recomputeNearby: false
        });
        ok = tryFocus();
      }, 560);
    }

    if (!ok) {
      setTimeout(() => {
        App.renderAll?.({
          rebuildMarkers: true,
          recomputeNearby: false
        });
        tryFocus();
      }, 950);
    }
  }, 220);
}

App.actions?.clearQueuedDeepLink?.();
return { ok: true, eventId };};

}

function queueCalendarDateFromHashFlow() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return { ok: false, error: "EMPTY_HASH" };

  const params = new URLSearchParams(h);
  const dateStr = (params.get("d") || "").trim();
  if (!dateStr) return { ok: false, error: "MISSING_DATE" };

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!isValid) return { ok: false, error: "INVALID_DATE" };

  App.actions?.queueCalendarDate?.(dateStr);
  return { ok: true, dateStr };
}

function processQueuedCalendarDateFlow() {
  const dateStr = App.state.runtime.pendingCalendarDate;
  if (!dateStr) return { ok: false, error: "NO_PENDING_CALENDAR_DATE" };

  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) {
    App.actions?.clearQueuedCalendarDate?.();
    return { ok: false, error: "INVALID_DATE" };
  }

  const h = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  const eventId = (params.get("e") || "").trim();

  App.actions?.setCalendarMonth?.(new Date(y, m - 1, 1));

  App.ui?.clearListFocus?.();

  App.renderAll?.({
    rebuildMarkers: false,
    recomputeNearby: false
  });

  setTimeout(() => {
    App.ui?.openCalendarDayByDate?.(dateStr, eventId || null);
  }, 80);

  App.actions?.clearQueuedCalendarDate?.();
  return { ok: true, dateStr, eventId: eventId || null };
}


async function approveAllPendingCandidatesFlow() {
  if (!App.util?.canManageUI?.()) {
    alert("No tenés permisos para aprobar candidatos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const result = await App.candidates?.approvePendingCandidatesForSources?.([
    "zibilia",
    "alternativa"
  ]);

  if (!result?.ok && !result?.summary?.length) {
    alert("No se pudieron aprobar los candidatos.");
    return { ok: false, error: result?.error || "APPROVE_ALL_PENDING_FAILED" };
  }

  App.commit?.({
    persist: false,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });

  return result;
}

async function deleteSkippedCandidateFlow(candidateId = "") {
  if (!App.util?.canManageUI?.()) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const id = String(candidateId || "").trim();
  if (!id) {
    return { ok: false, error: "MISSING_CANDIDATE_ID" };
  }

  const result = await App.candidates?.deleteCandidateById?.(id);

  if (!result?.ok) {
    return { ok: false, error: result?.error || "DELETE_SKIPPED_CANDIDATE_FAILED" };
  }

  return {
    ok: true,
    candidateId: id
  };
}

  App.actions = {
    setLogin,
    login,
    logout,

    selectCategory,
    setCalendarMonth,

    startEditingEvent,
    stopEditingEvent,

    setEditingMode,
    setEditingSeriesId,

    setNearbyCenter,
    setNearbyEvents,

    queueDeepLink,
    clearQueuedDeepLink,
    queueDeepLinkFromHashFlow,
    processQueuedDeepLinkFlow,
    queueCalendarDate,
    clearQueuedCalendarDate,

    highlightPendingPopupEvent,
    clearPendingPopupEvent,

    setBootReady,

    commitAndRender,
    toggleFavorite,
    saveAndRefresh,
    deleteEventFlow,
    shareEventFlow,
    routeToEventFlow,
    focusEventOnMapFlow,
    focusPlaceOnMapFlow,
    approveEventCandidatesBulkFlow,
    approvePendingCandidatesBySourceFlow,
    deleteSkippedCandidateFlow,
    approveAllPendingCandidatesFlow,
        queueCalendarDateFromHashFlow,
    processQueuedCalendarDateFlow,
    setFavoritesOnly,
    toggleFavoritesOnly,
    importZibiliaCandidatesFlow
  };
})();