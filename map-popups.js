// map-popups.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});
  const { state, util } = App;

  function categoryTagHTML(ev) {
    const t = util.categoryLabel(ev?.category);
    return t ? ` <span class="catTag">${t}</span>` : "";
  }

function canManageUI() {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1";
  return !!state.logic.isLoggedIn && isAdminMode;
}

  function buildPlacePopupHTML(loc) {
    if (!loc) return "";

    const placeNameFull =
      (loc.events?.find((e) => (e.placeName || "").trim())?.placeName || "").trim();
    const placeName = util.shortPlaceName(placeNameFull);
    const placeTitle = placeName ? placeName : "Eventos en este punto";

    const sorted = [...(loc.events || [])].sort(util.sortEventsByStatusThenTime);
    const total = sorted.length;

    const actionBtn = canManageUI()
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
            <div class="popupSub">${total} ${total === 1 ? "evento" : "eventos"} hoy</div>
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
              <button class="popupBtn shareBtn"
                data-eid="${encodeURIComponent(eid)}"
                data-title="${encodeURIComponent(e.title || "")}"
                title="Copiar link de este evento">
                Compartir
              </button>

              ${
                canManageUI()
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