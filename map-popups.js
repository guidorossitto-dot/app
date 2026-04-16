// map-popups.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});
  const { state, util } = App;

  function categoryTagHTML(ev) {
    const t = util.categoryLabel(ev?.category);
    return t ? ` <span class="catTag">${t}</span>` : "";
  }

  function getPopupEventsForLocation(events = []) {
  const list = Array.isArray(events) ? [...events] : [];
  if (!list.length) return [];

  const today = typeof util.todayStrYYYYMMDD === "function"
    ? util.todayStrYYYYMMDD()
    : new Date().toISOString().slice(0, 10);

  const todayEvents = list.filter((e) => e?.date === today);

  if (todayEvents.length) {
    return todayEvents.sort(util.sortEventsByStatusThenTime);
  }

  return list.sort(util.sortEventsByStatusThenTime);
}

function normalizePopupText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getEventInfoHref(ev) {
  const link = String(ev?.link || "").trim();
  const flyerUrl = String(ev?.flyerUrl || "").trim();

  if (link) return link;
  if (flyerUrl) return flyerUrl;
  return "";
}

function getEventInfoLabel(ev) {
  const link = String(ev?.link || "").trim();
  const flyerUrl = String(ev?.flyerUrl || "").trim();

  if (link && flyerUrl) return "Ver info";
  if (link) return "Ver info";
  if (flyerUrl) return "Ver flyer";
  return "";
}

function findVenueForPopup(loc, placeName) {
  const venues = Array.isArray(state.logic?.venues) ? state.logic.venues : [];
  if (!venues.length) return null;

  const targetName = normalizePopupText(util.shortPlaceName(placeName));
  let best = null;

  for (const venue of venues) {
if (!venue) continue;
if (!Number.isFinite(Number(venue.lat)) || !Number.isFinite(Number(venue.lng))) continue;

    const venueName = normalizePopupText(util.shortPlaceName(venue.name || ""));
    const sameName = !!targetName && targetName === venueName;
    const dist = util.distanceKm(loc.lat, loc.lng, venue.lat, venue.lng);

    if (!sameName || dist > 0.15) continue;

    if (!best || dist < best.dist) {
      best = { ...venue, dist };
    }
  }

  return best;
}

    function buildPlacePopupHTML(loc) {
    if (!loc) return "";

    const placeNameFull =
      (loc.events?.find((e) => (e.placeName || "").trim())?.placeName || "").trim();
    const placeName = util.shortPlaceName(placeNameFull);
    const placeTitle = placeName ? placeName : "Eventos en este punto";
const matchedVenue = findVenueForPopup(loc, placeNameFull || placeTitle);
const menuUrl = String(matchedVenue?.menuUrl || "").trim();

    const sorted = getPopupEventsForLocation(loc.events || []);
    const total = sorted.length;

    const uniqueDates = [...new Set(sorted.map(e => e.date).filter(Boolean))];

let subText = `${total} ${total === 1 ? "evento" : "eventos"}`;

if (uniqueDates.length === 1) {
  subText += ` · ${util.formatDateDisplay(uniqueDates[0])}`;
}

    const actionBtn = util.canManageUI()
  ? `<button class="popupBtn popupBtnPrimary popupAddBtn"
        data-lat="${loc.lat}"
        data-lng="${loc.lng}"
        data-place="${encodeURIComponent(placeName || "")}">
      Cargar evento acá
    </button>`
  : "";
  const menuBtn = menuUrl
  ? `
    <a class="popupBtn"
      href="${menuUrl}"
      target="_blank"
      rel="noopener noreferrer">
      Ver carta
    </a>
  `
  : "";

    const centerBtn = `
      <button class="popupBtn popupCenterBtn"
        data-lat="${loc.lat}"
        data-lng="${loc.lng}">
        Centrar
      </button>
    `;

    const routeBtn = `
      <button class="popupBtn popupRouteBtn"
        data-lat="${loc.lat}"
        data-lng="${loc.lng}"
        data-place="${encodeURIComponent(placeTitle || "")}">
        Cómo llegar
      </button>
    `;

    let html = `
      <div class="popupCard">
        <div class="popupHeader">
          <div>
            <div class="popupPlace">${placeTitle}</div>
            <div class="popupSub">${subText}</div>
          </div>
        </div>

        <div class="popupActions">
           ${centerBtn}
            ${routeBtn}
           ${menuBtn}
            ${actionBtn}
          </div>

        <div class="popupList">
    `;

 for (const e of sorted) {
  const st = util.formatTimeStart(e);
  const status = util.getEventStatus(e);
  const eid = e.id != null ? String(e.id) : "";
  const infoHref = getEventInfoHref(e);
const infoLabel = getEventInfoLabel(e);

  html += `
    <div class="popupItem" ${eid ? `data-eid="${encodeURIComponent(eid)}"` : ""}>
      <div class="popupItemTitle">
        <div style="min-width:0;">
          ${st ? `<span style="opacity:.75;margin-right:6px">${st}</span>` : ""}
          <span style="word-break:break-word;">${e.title}${categoryTagHTML(e)}</span>
          ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
        </div>
      </div>

      <div class="popupItemMeta">${util.formatDateDisplay(e.date)}</div>

      ${
        eid
          ? `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;">
  ${
  infoHref
    ? `<a class="popupBtn" href="${infoHref}" target="_blank" rel="noopener noreferrer">
        ${infoLabel}
      </a>`
    : ""
}

  <button class="popupBtn favoriteBtn"
  data-eid="${encodeURIComponent(eid)}"
  aria-pressed="${App.events?.isFavorite?.(eid) ? "true" : "false"}">
  ${App.events?.isFavorite?.(eid) ? "❤️ Guardado" : "🤍 Guardar"}
</button>

  <button class="popupBtn shareBtn"
    data-eid="${encodeURIComponent(eid)}"
    data-title="${encodeURIComponent(e.title || "")}"
    title="Copiar link de este evento">
    Compartir
  </button>

  ${
    util.canManageUI()
      ? `
        <button class="popupBtn popupEditBtn"
          data-edit-eid="${encodeURIComponent(eid)}">
          ✏️ Editar
        </button>

        <button class="popupBtn deleteEventBtn"
          data-delete-eid="${encodeURIComponent(eid)}"
          data-delete-title="${encodeURIComponent(e.title || "")}">
          🗑 Borrar
        </button>
      `
      : ""
  }
</div>
          `
          : ""
      }
    </div>
  `;
}

    html += `
        </div>
      </div>
    `;

    return html;
  }

  App.map = App.map || {};
  App.map.buildPlacePopupHTML = buildPlacePopupHTML;
})();