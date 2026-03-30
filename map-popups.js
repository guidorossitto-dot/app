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

    function buildPlacePopupHTML(loc) {
    if (!loc) return "";

    const placeNameFull =
      (loc.events?.find((e) => (e.placeName || "").trim())?.placeName || "").trim();
    const placeName = util.shortPlaceName(placeNameFull);
    const placeTitle = placeName ? placeName : "Eventos en este punto";

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
    e.link
      ? `<a class="popupBtn" href="${e.link}" target="_blank" rel="noopener noreferrer">
          Ver info
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