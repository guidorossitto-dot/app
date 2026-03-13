// ui-calendar.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state, selectors } = App;

  /* =========================
     CATEGORY HTML HELPERS
  ========================= */
function canManageUI() {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1";
  return !!state.logic.isLoggedIn && isAdminMode;
}

async function shareEventFromButton(btn) {
  if (!btn) return { ok: false };

  const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
  if (!eventId) return { ok: false };

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
      return { ok: true, mode: "native" };
    } catch {}
  }

  try {
    await navigator.clipboard.writeText(shareText);
    const prev = btn.textContent;
    btn.textContent = "Link copiado ✅";
    setTimeout(() => {
      btn.textContent = prev || "Compartir";
    }, 1200);
    return { ok: true, mode: "clipboard" };
  } catch {
    window.prompt("Copiá este link:", shareText);
    return { ok: true, mode: "prompt" };
  }
}

async function deleteEventFromButton(btn) {
  if (!btn) return { ok: false };

  if (!canManageUI()) {
    alert("No tenés permisos para borrar eventos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const eventId = decodeURIComponent(
    (btn.dataset.deleteEid || btn.dataset.eid || btn.dataset.id || "").trim()
  );
  if (!eventId) {
    return { ok: false, error: "MISSING_ID" };
  }

  const title = decodeURIComponent(
    (btn.dataset.deleteTitle || btn.dataset.title || "").trim()
  );

  const msg = title
    ? `¿Seguro que querés borrar "${title}"?`
    : "¿Seguro que querés borrar este evento?";

  if (!confirm(msg)) {
    return { ok: false, error: "CANCELLED" };
  }

  const result = await App.events?.removeEvent?.(eventId);

  if (!result?.ok) {
    alert("No se pudo borrar el evento.");
    return { ok: false, error: result?.error || "DELETE_FAILED" };
  }

  if (state.logic.editingEventId === eventId) {
    App.actions?.stopEditingEvent?.();
  }

  if (state.runtime.map) {
    state.runtime.map.closePopup();
  }

  App.commit?.({
    persist: true,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });

  return { ok: true, eventId };
}

  function categoryTagHTML(ev) {
    const t = util.categoryLabel(ev?.category);
    return t ? `<span class="catTag">${t}</span>` : "";
  }

  /* =========================
     GROUP BY PLACE + RENDER
  ========================= */
  function groupByPlace(list) {
    return selectors.getGroupedEvents(list || []);
  }

  function formatDistance(ev) {
  if (!ev || typeof ev.distanceKm !== "number") return "";

  const km = ev.distanceKm;

  if (km < 1) {
    return `🚶 ${Math.round(km * 1000)} m`;
  }

  return `🚶 ${km.toFixed(1)} km`;
}

 function renderGroupedList(ul, list) {
  if (!ul) return;
  ul.innerHTML = "";

  if (!list || list.length === 0) {
    ul.innerHTML = "<li>No hay eventos</li>";
    return;
  }

  const groups = groupByPlace(list);

  const renderEv = (ev) => {
    const time = util.formatTimeStart(ev);
    const status = util.getEventStatus(ev);

    let soonBadge = "";

if (
  status &&
  typeof ev.distanceKm === "number" &&
  ev.distanceKm <= 1
) {
  soonBadge = `🔥 ${status}`;
}

    const icon =
      ev.category === "music" ? "🎵" :
      ev.category === "dance" ? "💃" :
      ev.category === "theatre" ? "🎭" :
      ev.category === "visual_arts" ? "🖼️" :
      ev.category === "cinema" ? "🎬" :
      "📍";

    return `
      <article class="eventMiniCard eventMiniCard--${ev.category || "default"}">
        <div class="eventMiniCard__top">
          <div class="eventMiniCard__icon" aria-hidden="true">${icon}</div>

          <div class="eventMiniCard__main">
            <div class="eventMiniCard__titleRow">
              ${
                time
                  ? `<span class="eventMiniCard__time">${time}</span>`
                  : ""
              }

              <span class="eventMiniCard__title">${ev.title || "Evento"}</span>

              ${categoryTagHTML(ev)}

             ${
  soonBadge
    ? `<span class="eventMiniCard__status">${soonBadge}</span>`
    : ""
}
            </div>

            <div class="eventMiniCard__meta">
  ${util.formatDateDisplay(ev.date)}
  ${formatDistance(ev)}
</div>
          </div>
        </div>

        <div class="eventMiniCard__actions">
          <button class="linkBtn routeBtn"
            data-lat="${ev.lat}"
            data-lng="${ev.lng}"
            data-place="${encodeURIComponent(ev.title || ev.placeName || "")}">
            Cómo llegar
          </button>

          <button class="linkBtn shareBtn"
            data-eid="${encodeURIComponent(ev.id)}"
            data-title="${encodeURIComponent(ev.title || "")}">
            Compartir
          </button>

          ${
            canManageUI()
              ? `<button class="linkBtn deleteEventBtn"
                  data-delete-eid="${encodeURIComponent(ev.id)}"
                  data-delete-title="${encodeURIComponent(ev.title || "")}">
                  Borrar
                </button>`
              : ""
          }
        </div>
      </article>
    `;
  };

  for (const g of groups) {
    const placeTitle = g.placeTitle;
    const count = g.count;
    const evs = g.events;
    const badge = g.badge;

    const li = document.createElement("li");

    if (count === 1) {
      li.innerHTML = `
        <div style="padding:8px 0;border-top:1px solid #eee">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div>
              <div style="font-weight:500" data-place-title>${placeTitle}</div>
              ${badge ? `<div style="opacity:.7;font-size:.9em;margin-top:2px">${badge}</div>` : ""}
            </div>

            <button class="linkBtn mapPlaceBtn"
              data-lat="${g.lat}"
              data-lng="${g.lng}"
              data-key="${g.key}"
              type="button">
              Ver en mapa
            </button>
          </div>

          <div style="margin-top:6px">
            ${renderEv(evs[0])}
          </div>
        </div>
      `;

      ul.appendChild(li);
      continue;
    }

    li.innerHTML = `
      <details class="accordion" style="margin:6px 0">
       <summary style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;font-weight:500">
  <span>
    📍 ${placeTitle} ▾
    <span style="opacity:.65;margin-left:4px">
      ${count} ${count === 1 ? "evento" : "eventos"}
    </span>
    ${badge ? `<span style="opacity:.7;font-size:.9em;margin-left:8px">${badge}</span>` : ""}
  </span>

  <button class="linkBtn mapPlaceBtn"
    data-lat="${g.lat}"
    data-lng="${g.lng}"
    data-key="${g.key}"
    type="button">
    Ver en mapa
  </button>
</summary>

        <div style="padding:6px 8px">
          ${evs.map(renderEv).join("")}
        </div>
      </details>
    `;

    ul.appendChild(li);
  }
}

  /* =========================
     APP SHELL
  ========================= */
  function renderAppShell() {
  const adminView = document.getElementById("adminView");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const params = new URLSearchParams(window.location.search);
  const adminMode = params.get("admin") === "1";

  if (adminView) adminView.hidden = !canManageUI();

  if (!adminMode) {
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    return;
  }

  if (loginBtn) {
    loginBtn.style.display = "";
    loginBtn.hidden = state.logic.isLoggedIn;
  }

  if (logoutBtn) {
    logoutBtn.style.display = "";
    logoutBtn.hidden = !state.logic.isLoggedIn;
  }
}

  /* =========================
     LISTAS
  ========================= */
    function renderEvents(list, emptyMsg = "No hay próximos eventos") {
  const ul = document.getElementById("eventList");
  if (!ul) return;

  const safeList = Array.isArray(list)
    ? list
    : selectors.getVisibleFutureEvents(state.logic.events || []);

  if (!safeList || safeList.length === 0) {
    ul.innerHTML = `<li>${emptyMsg}</li>`;
    return;
  }

  renderGroupedList(ul, safeList);
}

function renderTodayEvents(list, emptyMsg = "No hay eventos hoy") {
  const ul = document.getElementById("todayEvents");
  if (!ul) return;

  const safeList = Array.isArray(list)
    ? list
    : selectors.getVisibleTodayEvents(state.logic.events || []);

  if (!safeList || safeList.length === 0) {
    ul.innerHTML = `<li>${emptyMsg}</li>`;
    return;
  }

  renderGroupedList(ul, safeList);
}

function renderNearbyEvents(list) {
  const ul = document.getElementById("nearbyList");
  if (!ul) return;

  const safeList = Array.isArray(list)
    ? list
    : selectors.getTodayNearbyEvents(state.logic.nearbyEvents || []);

  if (!safeList || safeList.length === 0) {
    ul.innerHTML = "<li>No hay eventos a 2 km</li>";
    return;
  }

  renderGroupedList(ul, safeList);
}

function renderSingleEventItemHTML(ev) {
  const time = util.formatTimeStart(ev);
  const status = util.getEventStatus(ev);
  const place = util.shortPlaceName(ev.placeName) || "";
  const dateLabel = util.formatDateDisplay(ev.date);
  const locationKey = util.smartLocationKey(ev, state.logic.events || []);

  return `
    <div class="eventCard">
      <div class="eventCardDate">
        ${dateLabel}
      </div>

      <div class="eventCardMain">
        <div class="eventCardTitleRow">
          <div class="eventCardTitleWrap">
            <div class="eventCardTitle">
              ${ev.title || "Sin título"}
            </div>
            <div class="eventCardCategory">
              ${categoryTagHTML(ev)}
            </div>
          </div>
        </div>

        <div class="eventCardMeta">
          ${time ? `<span class="eventCardTime">${time}</span>` : ""}
          ${status ? `<span class="eventCardStatus">${status}</span>` : ""}
        </div>

        ${
          place
            ? `<div class="eventCardPlace">${place}</div>`
            : ""
        }

        <div class="eventCardActions">
          <button class="linkBtn mapFocusBtn"
            data-eid="${encodeURIComponent(ev.id || "")}"
            data-lat="${ev.lat}"
            data-lng="${ev.lng}"
            data-key="${locationKey}">
            Ver en mapa
          </button>

          <button class="linkBtn routeBtn"
            data-lat="${ev.lat}"
            data-lng="${ev.lng}"
            data-place="${encodeURIComponent(ev.title || ev.placeName || "")}">
            Cómo llegar
          </button>

          <button class="linkBtn shareBtn"
            data-eid="${encodeURIComponent(ev.id || "")}"
            data-title="${encodeURIComponent(ev.title || "")}">
            Compartir
          </button>

          ${
            canManageUI()
              ? `<button class="linkBtn deleteEventBtn"
                  data-delete-eid="${encodeURIComponent(ev.id || "")}"
                  data-delete-title="${encodeURIComponent(ev.title || "")}">
                  Borrar
                </button>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

 function renderEventsIntoUl(ulId, list, emptyMsg) {
  const ul = document.getElementById(ulId);
  if (!ul) return;
  ul.innerHTML = "";

  const filtered = util.filterByActiveCategory(list || []);

  if (!filtered || filtered.length === 0) {
    ul.innerHTML = `<li class="eventEmpty">${emptyMsg || "No hay eventos"}</li>`;
    return;
  }

  const sorted = [...filtered].sort(util.sortEventsByStatusThenTime);

  sorted.forEach((ev) => {
    const li = document.createElement("li");
    li.className = "eventListItem";
    li.innerHTML = renderSingleEventItemHTML(ev);
    ul.appendChild(li);
  });
}

  function updateNearbyCount(list = state.logic.nearbyEvents) {
    const topEl = document.getElementById("nearbyCount");
    const bottomEl = document.getElementById("nearbySummaryBlock");

    if (topEl) topEl.innerHTML = "";
    if (bottomEl) bottomEl.innerHTML = "";

    if (!topEl && !bottomEl) return;

    if (!list || list.length === 0) {
      if (topEl) {
        topEl.innerHTML = `
          <div class="mapActionBar mapActionBar--insideNearby">
            <button id="autoLocationBtnInline" class="primaryMapActionBtn">📍 Eventos cerca mío</button>
          </div>
          <div class="nearbyInlineEmpty">
            No hay eventos cerca tuyo hoy
          </div>
        `;
      }

      if (bottomEl) {
        bottomEl.innerHTML = `
          <div class="nearbyInlineEmpty">
            No hay eventos cerca tuyo hoy
          </div>
        `;
      }

      const inlineBtn = document.getElementById("autoLocationBtnInline");
      if (inlineBtn) inlineBtn.addEventListener("click", () => App.map?.useMyLocation?.());

      return;
    }

    const today = util.todayStrYYYYMMDD();
    const todayList = (list || []).filter((ev) => (ev?.date || "").slice(0, 10) === today);

    if (todayList.length === 0) {
      if (topEl) {
        topEl.innerHTML = `
          <div class="mapActionBar mapActionBar--insideNearby">
            <button id="autoLocationBtnInline" class="primaryMapActionBtn">📍 Eventos cerca mío</button>
          </div>
          <div class="nearbyInlineEmpty">
            No hay eventos cerca tuyo hoy
          </div>
        `;
      }

      if (bottomEl) {
        bottomEl.innerHTML = `
          <div class="nearbyInlineEmpty">
            No hay eventos cerca tuyo hoy
          </div>
        `;
      }

      const inlineBtn = document.getElementById("autoLocationBtnInline");
      if (inlineBtn) inlineBtn.addEventListener("click", () => App.map?.useMyLocation?.());

      return;
    }

    const cat = state.logic.activeCategory || "all";
    const catChip = cat === "all" ? "" : `<span class="miniChip">${util.categoryLabel(cat)}</span>`;

    const featuredList = selectors.getFeaturedNearbyEvents(todayList);
    const mainFeatured = featuredList[0] || null;
    const extraFeatured = featuredList.slice(1);

    function renderFeaturedCard(featured) {
      const featuredStatus = util.getEventStatus(featured);
      const featuredPlace = util.shortPlaceName(featured.placeName) || "Lugar sin nombre";
      const featuredKey = util.smartLocationKey(featured, state.logic.events || []);

      return `
        <div class="featuredBox">
          <div class="featuredTop">
            <div class="featuredKicker">
              <span class="featuredFire">🔥</span>
              <span>DESTACADO ${catChip ? "· " + catChip : ""}</span>
            </div>
            <button class="linkBtn mapFocusBtn"
  data-eid="${encodeURIComponent(featured.id || "")}"
  data-lat="${featured.lat}"
  data-lng="${featured.lng}"
  data-key="${featuredKey}">
  Ver en mapa
</button>
          </div>

          <div class="featuredTitle">
            ${util.formatTimeStart(featured) ? `<span style="opacity:.75;margin-right:6px">${util.formatTimeStart(featured)}</span>` : ""}
            ${featured.title}
            ${featuredStatus ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${featuredStatus}</span>` : ""}
          </div>

          <div class="featuredMeta">
            ${featuredPlace} · ${util.formatDateDisplay(featured.date)}
          </div>
        </div>
      `;
    }

    const featuredHTML = mainFeatured
      ? `
        <div class="featuredStack">
          ${renderFeaturedCard(mainFeatured)}

          ${
            extraFeatured.length
              ? `
                <details class="featuredAccordion">
                  <summary class="featuredAccordionSummary">
                    🔥 Ver otros ${extraFeatured.length} destacado${extraFeatured.length === 1 ? "" : "s"}
                  </summary>
                  <div class="featuredAccordionBody">
                    ${extraFeatured.map(renderFeaturedCard).join("")}
                  </div>
                </details>
              `
              : ""
          }
        </div>
      `
      : "";

    const n = todayList.length;
    const header = n === 1 ? "1 evento cerca" : `${n} eventos cerca`;

    if (topEl) {
      topEl.innerHTML = `
        ${featuredHTML}
        <div class="mapActionBar mapActionBar--insideNearby">
          <button id="autoLocationBtnInline" class="primaryMapActionBtn">📍 Eventos cerca mío</button>
        </div>
      `;
    }

    if (bottomEl) {
      bottomEl.innerHTML = `
        <div class="nearbyInlineHeader">
          <span class="nearbyInlineCount">${header}</span>
          ${catChip}
        </div>
      `;
    }

    const inlineBtn = document.getElementById("autoLocationBtnInline");
    if (inlineBtn) inlineBtn.addEventListener("click", () => App.map?.useMyLocation?.());
  }

  function setListFocus(focus) {
    state.runtime = state.runtime || {};
    state.runtime.listFocus = focus || null;
  }

  function clearListFocus() {
    if (!state.runtime) return;
    state.runtime.listFocus = null;
  }

  function getFocusedEvent() {
    const focus = state.runtime?.listFocus;
    if (!focus || focus.type !== "event" || !focus.eventId) return null;
    return App.events?.findEventById?.(focus.eventId) || null;
  }

  function getListRenderState() {
    const focus = state.runtime?.listFocus || null;
    const today = util.todayStrYYYYMMDD();

    if (!focus) {
      return {
        todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
        todayEmpty: "No hay eventos hoy",
        futureList: selectors.getVisibleFutureEvents(state.logic.events || []),
        futureEmpty: "No hay próximos eventos"
      };
    }

    if (focus.type === "day" && focus.dateStr) {
      const dayEvents = util.getEventsOnDate(focus.dateStr, state.logic.events || []);

      if (focus.dateStr === today) {
        return {
          todayList: util.filterByActiveCategory(dayEvents),
          todayEmpty: "No hay eventos hoy",
          futureList: [],
          futureEmpty: "No hay próximos eventos"
        };
      }

      if (focus.dateStr > today) {
        return {
          todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
          todayEmpty: "No hay eventos hoy",
          futureList: util.filterByActiveCategory(dayEvents),
          futureEmpty: "No hay eventos ese día"
        };
      }

      return {
        todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
        todayEmpty: "No hay eventos hoy",
        futureList: [],
        futureEmpty: "Ese día ya pasó"
      };
    }

    if (focus.type === "event") {
      const ev = getFocusedEvent();

      if (!ev) {
        return {
          todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
          todayEmpty: "No hay eventos hoy",
          futureList: selectors.getVisibleFutureEvents(state.logic.events || []),
          futureEmpty: "No hay próximos eventos"
        };
      }

      const dateStr = (ev.date || "").slice(0, 10);

      if (dateStr === today) {
        return {
          todayList: util.filterByActiveCategory([ev]),
          todayEmpty: "No hay eventos hoy",
          futureList: [],
          futureEmpty: "No hay próximos eventos"
        };
      }

      if (dateStr > today) {
        return {
          todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
          todayEmpty: "No hay eventos hoy",
          futureList: util.filterByActiveCategory([ev]),
          futureEmpty: "No hay próximos eventos"
        };
      }

      return {
        todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
        todayEmpty: "No hay eventos hoy",
        futureList: [],
        futureEmpty: "Ese evento ya pasó"
      };
    }

    return {
      todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
      todayEmpty: "No hay eventos hoy",
      futureList: selectors.getVisibleFutureEvents(state.logic.events || []),
      futureEmpty: "No hay próximos eventos"
    };
  }

    function renderList() {
    const view = getListRenderState();

    renderTodayEvents(view.todayList, view.todayEmpty);
    renderEvents(view.futureList, view.futureEmpty);
    renderNearbyEvents(state.logic.nearbyEvents);
    updateNearbyCount(state.logic.nearbyEvents);
  }
  /* =========================
     CALENDARIO
  ========================= */
  function formatDateYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function eventsByDateMap() {
    const mapObj = {};
    const visible = util.filterByActiveCategory(state.logic.events || []);

    for (const ev of visible) {
      if (!ev?.date) continue;
      if (!mapObj[ev.date]) mapObj[ev.date] = [];
      mapObj[ev.date].push(ev);
    }

    return mapObj;
  }

  function removeCalendarPopover() {
    const old = document.getElementById("calendarEventPopover");
    if (old) old.remove();
  }

  function showCalendarEventPopover(anchorEl, ev) {
    if (!anchorEl || !ev) return;

    removeCalendarPopover();

    const pop = document.createElement("div");
    pop.id = "calendarEventPopover";
    pop.className = "calendarEventPopover";

    const time = util.formatTimeStart(ev);
    const place = util.shortPlaceName(ev.placeName) || "Lugar sin nombre";
    const dateText = util.formatDateDisplay(ev.date);
    const icon =
  ev.category === "music" ? "🎵" :
  ev.category === "dance" ? "💃" :
  ev.category === "theatre" ? "🎭" :
  ev.category === "visual_arts" ? "🖼️" :
  ev.category === "cinema" ? "🎬" :
  "📍";

    pop.innerHTML = `
      <div class="calendarEventPopover__title">
  <span class="calendarEventIcon">${icon}</span>
  <span class="calendarEventTitleText">${ev.title || "Evento"}</span>
</div>
      <div class="calendarEventPopover__meta">
        ${time ? `<div><strong>Hora:</strong> ${time}</div>` : ""}
        <div><strong>Lugar:</strong> ${place}</div>
        <div><strong>Fecha:</strong> ${dateText}</div>
      </div>
      <div class="calendarEventPopover__actions">
        <button type="button" class="linkBtn calendarPopoverMapBtn">Ver en mapa</button>
        <button type="button" class="linkBtn calendarPopoverCloseBtn">Cerrar</button>
      </div>
    `;

    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();

    let top = window.scrollY + rect.bottom + 8;
    let left = window.scrollX + rect.left;

    const maxLeft = window.scrollX + window.innerWidth - popRect.width - 12;
    if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);

    pop.style.position = "absolute";
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.zIndex = "9999";

    const closeBtn = pop.querySelector(".calendarPopoverCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeCalendarPopover();
      });
    }

    const mapBtn = pop.querySelector(".calendarPopoverMapBtn");
    if (mapBtn) {
      mapBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        removeCalendarPopover();

        const mapEl = document.getElementById("map");
        if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

        const key = util.smartLocationKey(ev, state.logic.events || []);
        const loc = state.runtime.locationMarkers?.[key];

        if (App.map?.focusEventById && ev.id) {
          App.map.focusEventById(ev.id);
          return;
        }

        if (state.runtime.map && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
          state.runtime.map.setView([ev.lat, ev.lng], 16);
          if (loc?.marker) loc.marker.openPopup();
        }
      });
    }

    requestAnimationFrame(() => {
      const onDocClick = (e) => {
        if (!pop.contains(e.target) && e.target !== anchorEl) {
          removeCalendarPopover();
          document.removeEventListener("click", onDocClick, true);
        }
      };

      document.addEventListener("click", onDocClick, true);
    });
  }

  function showCalendarDayPopover(anchorEl, dateStr, events) {
    if (!anchorEl) return;

    removeCalendarPopover();

    const pop = document.createElement("div");
    pop.id = "calendarEventPopover";
    pop.className = "calendarEventPopover calendarEventPopover--dayList";

    const safeEvents = [...(events || [])].sort(util.sortEventsByStatusThenTime);
    const dateText = util.formatDateDisplay(dateStr);

    pop.innerHTML = `
      <div class="calendarEventPopover__title">Eventos del ${dateText}</div>
      <div class="calendarDayPopover__list">
        ${
          safeEvents.length
            ? safeEvents.map((ev) => {
                const time = util.formatTimeStart(ev);
                const place = util.shortPlaceName(ev.placeName) || "Lugar sin nombre";
                const status = util.getEventStatus(ev);
                const icon =
  ev.category === "music" ? "🎵 " :
  ev.category === "dance" ? "💃 " :
  ev.category === "theatre" ? "🎭 " :
  ev.category === "visual_arts" ? "🖼️ " :
  ev.category === "cinema" ? "🎬 " :
  "";

                return `
                  <div class="calendarDayPopover__item" data-eid="${encodeURIComponent(ev.id || "")}" style="cursor:pointer;">
                    <div class="calendarDayPopover__itemTitle">
                      <span class="calendarEventIcon">${icon}</span>
                      <span class="calendarEventTitleText">${ev.title || "Evento"}</span>
                  </div>
                    <div class="calendarDayPopover__itemMeta">
                      ${time ? `<div><strong>Hora:</strong> ${time}</div>` : ""}
                      <div><strong>Lugar:</strong> ${place}</div>
                      ${status ? `<div><strong>Estado:</strong> ${status}</div>` : ""}
                    </div>
                  </div>
                `;
              }).join("")
            : `<div class="calendarDayPopover__empty">No hay eventos para este día</div>`
        }
      </div>
      <div class="calendarEventPopover__actions">
        <button type="button" class="linkBtn calendarPopoverCloseBtn">Cerrar</button>
      </div>
    `;

    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();

    let top = window.scrollY + rect.bottom + 8;
    let left = window.scrollX + rect.left;

    const maxLeft = window.scrollX + window.innerWidth - popRect.width - 12;
    if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);

    const maxTop = window.scrollY + window.innerHeight - popRect.height - 12;
    if (top > maxTop) {
      top = Math.max(window.scrollY + 12, window.scrollY + rect.top - popRect.height - 8);
    }

    pop.style.position = "absolute";
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.zIndex = "9999";

    const closeBtn = pop.querySelector(".calendarPopoverCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeCalendarPopover();
      });
    }
    pop.querySelectorAll(".calendarDayPopover__item[data-eid]").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const eventId = decodeURIComponent(item.dataset.eid || "");
    if (!eventId) return;

    removeCalendarPopover();

    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

    if (App.map?.focusEventById) {
      App.map.focusEventById(eventId);
    }
  });
});

    
    requestAnimationFrame(() => {
      const onDocClick = (e) => {
        if (!pop.contains(e.target) && e.target !== anchorEl) {
          removeCalendarPopover();
          document.removeEventListener("click", onDocClick, true);
        }
      };

      document.addEventListener("click", onDocClick, true);
    });
  }

    function openCalendarDay(dateStr, anchorEl = null) {
    if (anchorEl) {
      const dayEvents = util.getEventsOnDate(dateStr, state.logic.events);
      showCalendarDayPopover(anchorEl, dateStr, dayEvents);
      return;
    }

    removeCalendarPopover();
    setListFocus({ type: "day", dateStr });
    renderAll({
      rebuildMarkers: false,
      recomputeNearby: false
    });
  }

  function renderCalendar() {
    const cal = document.getElementById("calendar");
    const label = document.getElementById("monthLabel");
    if (!cal) return;

    removeCalendarPopover();
    cal.innerHTML = "";

    const year = state.logic.calendarCursor.getFullYear();
    const month = state.logic.calendarCursor.getMonth();

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    if (label) label.textContent = `${monthNames[month]} ${year}`;

    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const byDate = eventsByDateMap();

    for (let i = 0; i < 42; i++) {
      const cell = document.createElement("div");
      cell.className = "day";

      let dayNum;
      let cellDate;

      if (i < startDow) {
        dayNum = prevMonthDays - (startDow - 1 - i);
        cell.classList.add("muted");
        cellDate = new Date(year, month - 1, dayNum);
      } else if (i >= startDow + daysInMonth) {
        dayNum = i - (startDow + daysInMonth) + 1;
        cell.classList.add("muted");
        cellDate = new Date(year, month + 1, dayNum);
      } else {
        dayNum = i - startDow + 1;
        cellDate = new Date(year, month, dayNum);
      }

      const dateStr = formatDateYYYYMMDD(cellDate);

      const dn = document.createElement("div");
      dn.className = "day-number";
      dn.textContent = dayNum;
      cell.appendChild(dn);

      const evs = byDate[dateStr] || [];

const isMobile = window.innerWidth <= 768;
const maxVisible = isMobile ? 2 : 3;

evs.slice(0, maxVisible).forEach((ev) => {
  const b = document.createElement("div");
  b.className = "event";

  const icon =
  ev.category === "music" ? "🎵 " :
  ev.category === "dance" ? "💃 " :
  ev.category === "theatre" ? "🎭 " :
  ev.category === "visual_arts" ? "🖼️ " :
  ev.category === "cinema" ? "🎬 " :
  "";

  b.textContent = `${icon}${ev.title}`;
  b.dataset.eid = ev.id || "";

  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCalendarEventPopover(b, ev);
  });

  cell.appendChild(b);
});

if (evs.length > maxVisible) {
  const more = document.createElement("div");
  more.className = "event event-more";
  more.textContent = `+${evs.length - maxVisible} más`;

  more.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCalendarDayPopover(more, dateStr, evs);
  });

  cell.appendChild(more);
}

      cell.addEventListener("click", () => {
        openCalendarDay(dateStr);
      });

      cal.appendChild(cell);
    }
  }

  function bindSidebarUI() {
    const layout = document.querySelector(".appLayout--leftSidebar");
    const btn = document.getElementById("toggleSidebarBtn");
    if (!layout || !btn) return;

    const saved = localStorage.getItem("leftSidebarCollapsed");
    const startsCollapsed = saved === "true";

    if (startsCollapsed) {
      layout.classList.add("isCollapsed");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
      btn.title = "Expandir agenda";
    } else {
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "☰ Agenda";
      btn.title = "Contraer agenda";
    }

    btn.addEventListener("click", () => {
      const collapsed = layout.classList.toggle("isCollapsed");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.textContent = collapsed ? "☰" : "☰ Agenda";
      btn.title = collapsed ? "Expandir agenda" : "Contraer agenda";
      localStorage.setItem("leftSidebarCollapsed", String(collapsed));

      if (state.runtime.map) {
        setTimeout(() => {
          state.runtime.map.invalidateSize();
        }, 240);
      }
    });
  }

  function bindCalendarUI() {
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");

    if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      App.actions?.setCalendarMonth?.(
        new Date(
          state.logic.calendarCursor.getFullYear(),
          state.logic.calendarCursor.getMonth() - 1,
          1
        )
      );

      clearListFocus();

      commit({
        persist: false,
        purgePast: false,
        rebuildMarkers: false,
        recomputeNearby: false
      });
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      App.actions?.setCalendarMonth?.(
        new Date(
          state.logic.calendarCursor.getFullYear(),
          state.logic.calendarCursor.getMonth() + 1,
          1
        )
      );

      clearListFocus();

      commit({
        persist: false,
        purgePast: false,
        rebuildMarkers: false,
        recomputeNearby: false
      });
    });
  }
}

function bindCategoryUI() {
  const row = document.getElementById("categoryChips");
  if (!row) return;

  const chips = [...row.querySelectorAll(".chip")];

  function paintActive() {
    chips.forEach((btn) => {
      const on = btn.dataset.cat === (state.logic.activeCategory || "all");
      btn.classList.toggle("isActive", on);
    });
  }

  paintActive();

  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      App.actions?.selectCategory?.(btn.dataset.cat || "all");
      clearListFocus?.();
      paintActive();

      commit?.({
        persist: false,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });
    });
  });
}

  /* =========================
     CORE WRAPPERS (compat SSOT)
  ========================= */
  function renderAll(opts = {}) {
    return App.renderAll?.(opts);
  }

  function commit(opts = {}) {
    return App.commit?.(opts);
  }

  /* =========================
     BIND: login + public + admin
  ========================= */
  function bindLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        App.actions?.login?.();

        if (state.runtime.map) state.runtime.map.closePopup();

        commit({
          persist: true,
          purgePast: false,
          rebuildMarkers: true,
          recomputeNearby: true
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        App.actions?.logout?.();

        if (state.runtime.map) state.runtime.map.closePopup();

        App.map?.clearEventCreationMarker?.();

        commit({
          persist: true,
          purgePast: false,
          rebuildMarkers: true,
          recomputeNearby: true
        });
      });
    }
  }

 function bindPublicUI() {
  const searchBtn = document.getElementById("searchNearbyBtn");

  if (searchBtn && !searchBtn.classList.contains("debugHidden")) {
    searchBtn.addEventListener("click", () => App.map?.searchNearbyFromInputs?.());
  }
}

  function bindDeleteEventUI() {
  state.runtime = state.runtime || {};
  if (state.runtime.deleteUIBound) return;
  state.runtime.deleteUIBound = true;

  document.addEventListener("click", (e) => {

  const btn = e.target.closest(".mapPlaceBtn");
  if (!btn) return;


  e.preventDefault();
  e.stopPropagation();

  const lat = Number(btn.dataset.lat);
  const lng = Number(btn.dataset.lng);
  const key = btn.dataset.key || "";

  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loc = key ? state.runtime.locationMarkers?.[key] : null;


  if (loc?.marker && state.runtime.map) {
  const p = loc.marker.getLatLng();

  if (App.map?.openMarkerPopupStable) {
    App.map.openMarkerPopupStable(loc.marker, p.lat, p.lng, 16);
  } else {
    state.runtime.map.setView([p.lat, p.lng], 16);
    setTimeout(() => {
      try {
        loc.marker.openPopup();
      } catch {}
    }, 140);
  }

  return;
}

  if (!state.runtime.map || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  if (
    state.runtime.deepLinkLayer &&
    typeof state.runtime.deepLinkLayer.clearLayers === "function"
  ) {
    state.runtime.deepLinkLayer.clearLayers();
  }

  const placeTitle =
    btn.closest("li, .accordion, .panelCard, .featuredBox")
      ?.querySelector("[data-place-title]")?.textContent?.trim()
    || btn.closest("li, .accordion, .panelCard")
      ?.querySelector("div")?.textContent?.trim()
    || "Lugar";


  const tempMarker = L.marker([lat, lng], {
    bubblingMouseEvents: false
  });

  tempMarker.bindPopup(`
    <div class="popupCard">
      <div class="popupHeader">
        <div>
          <div class="popupPlace">${placeTitle}</div>
          <div class="popupSub">Ubicación del lugar</div>
        </div>
      </div>
    </div>
  `, {
    closeButton: true,
    autoPan: true,
    keepInView: true,
    autoPanPadding: [16, 16],
    offset: [0, -10],
    maxWidth: 260,
    minWidth: 180
  });

  if (state.runtime.deepLinkLayer) {
    tempMarker.addTo(state.runtime.deepLinkLayer);
  } else {
    tempMarker.addTo(state.runtime.map);
  }

  state.runtime.map.setView([lat, lng], 16);

  setTimeout(() => {
    try {
      tempMarker.openPopup();
    } catch {}
  }, 120);
});


document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".deleteEventBtn, .popupDeleteBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  await App.ui?.deleteEventFromButton?.(btn);
});
}

function bindAdminUI() {
  const addBtn = document.getElementById("addEventBtn");
  const clearBtn = document.getElementById("clearEventsBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const venueSearchInput = document.getElementById("venueSearchInput");

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      if (!canManageUI()) {
        alert("No tenés permisos para cargar eventos.");
        return;
      }

      await App.map?.createEventFromAdminForm?.();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!canManageUI()) {
        alert("No tenés permisos para borrar eventos.");
        return;
      }

      App.map?.clearAllEvents?.();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (!canManageUI()) {
        alert("No tenés permisos para editar eventos.");
        return;
      }

      App.actions?.stopEditingEvent?.();

      const titleEl = document.getElementById("eventTitle");
      const dateEl = document.getElementById("eventDate");
      const latEl = document.getElementById("eventLat");
      const lngEl = document.getElementById("eventLng");
      const placeEl = document.getElementById("eventPlace");
      const startEl = document.getElementById("eventStart");
      const catEl = document.getElementById("eventCategory");
      const addBtn2 = document.getElementById("addEventBtn");
      const venueSuggestions = document.getElementById("venueSuggestions");

      if (titleEl) titleEl.value = "";
      if (dateEl) dateEl.value = "";
      if (latEl) latEl.value = "";
      if (lngEl) lngEl.value = "";
      if (placeEl) placeEl.value = "";
      if (startEl) startEl.value = "";
      if (catEl) catEl.value = "music";
      if (addBtn2) addBtn2.textContent = "Agregar evento";
      if (venueSearchInput) venueSearchInput.value = "";
      if (venueSuggestions) venueSuggestions.innerHTML = "";

      App.venues?.clearSelectedVenueForAdmin?.();

      cancelBtn.hidden = true;
      App.map?.clearEventCreationMarker?.();
    });
  }

  if (venueSearchInput) {
    venueSearchInput.addEventListener("input", (e) => {
      if (!canManageUI()) {
        const box = document.getElementById("venueSuggestions");
        if (box) box.innerHTML = "";
        return;
      }

      const query = e.target.value || "";

      App.state.logic.adminVenueQuery = query;
      App.state.logic.adminVenueSuggestions =
        App.venues?.searchVenuesByName?.(query) || [];

      renderVenueSuggestions();
    });
  }
}

function renderVenueSuggestions() {
  const box = document.getElementById("venueSuggestions");
  if (!box) return;

  const items = App.state.logic.adminVenueSuggestions || [];

  if (!items.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = items.map((venue) => `
    <button
      type="button"
      class="venueSuggestionItem"
      data-venue-id="${venue.id}"
    >
      <strong>${venue.name}</strong><br>
      <small>${venue.address || ""}</small>
    </button>
  `).join("");
}

function applyVenueToAdminForm(venue) {
  if (!venue) return;

  const venueSearchInput = document.getElementById("venueSearchInput");
  const placeInput = document.getElementById("eventPlace");
  const latInput = document.getElementById("eventLat");
  const lngInput = document.getElementById("eventLng");
  const box = document.getElementById("venueSuggestions");

  if (venueSearchInput) venueSearchInput.value = venue.name;
  if (placeInput) placeInput.value = venue.name;
  if (latInput) latInput.value = venue.lat ?? "";
  if (lngInput) lngInput.value = venue.lng ?? "";
  if (box) box.innerHTML = "";
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".venueSuggestionItem");
  if (!btn) return;

  if (!canManageUI()) {
    alert("No tenés permisos para editar eventos.");
    return;
  }

  const venueId = btn.dataset.venueId;
  const result = App.venues?.selectVenueForAdmin?.(venueId);
  if (!result?.ok) return;

  applyVenueToAdminForm(result.venue);
});

  /* =========================
     DEEP LINK (#e=EVENT_ID)
  ========================= */
  function queueDeepLinkFromHash() {
    const h = (location.hash || "").replace(/^#/, "");
    if (!h) return;

    const params = new URLSearchParams(h);
    const eventId = (params.get("e") || "").trim();
    if (!eventId) return;

    App.actions?.queueDeepLink?.(decodeURIComponent(eventId));
  }

    function processQueuedDeepLink() {
    const eventId = state.runtime.pendingDeepLinkEventId;
    if (!eventId) return;

    const ev = App.events?.findEventById?.(eventId) || null;
    if (!ev) {
      App.actions?.clearQueuedDeepLink?.();
      clearListFocus();
      renderAll({
        rebuildMarkers: false,
        recomputeNearby: false
      });
      return;
    }

    document.title = ev?.title ? `${ev.title} · Agenda de eventos` : "Agenda de eventos";

    let categoryReset = false;

    if (
      state.logic.activeCategory &&
      state.logic.activeCategory !== "all" &&
      state.logic.activeCategory !== ev.category
    ) {
      App.actions?.selectCategory?.("all");
      categoryReset = true;

      const row = document.getElementById("categoryChips");
      if (row) {
        const chips = [...row.querySelectorAll(".chip")];
        chips.forEach((btn) => btn.classList.toggle("isActive", btn.dataset.cat === "all"));
      }
    }

    setListFocus({ type: "event", eventId });

    if (categoryReset) {
      commit({
        persist: false,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });
    } else {
      renderAll({
        rebuildMarkers: false,
        recomputeNearby: false
      });
    }

    if (state.runtime.bootReady && App.map?.focusEventById) {
      const ok = App.map.focusEventById(eventId);
      if (!ok) setTimeout(() => App.map?.focusEventById?.(eventId), 250);
    }

    App.actions?.clearQueuedDeepLink?.();
  }

  /* =========================
     LISTENERS DE HASH
  ========================= */
  document.addEventListener("DOMContentLoaded", () => {
    queueDeepLinkFromHash();
  });

  window.addEventListener("hashchange", () => {
    queueDeepLinkFromHash();
    processQueuedDeepLink();
  });

  document.addEventListener("click", (e) => {
  const btn = e.target.closest(".mapFocusBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

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
    if (ok) return;
  }

  const loc = key ? state.runtime.locationMarkers?.[key] : null;

  if (state.runtime.map && Number.isFinite(lat) && Number.isFinite(lng)) {
    state.runtime.map.setView([lat, lng], 16);
    if (loc?.marker) loc.marker.openPopup();
  }
});

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".routeBtn");
    if (!btn) return;

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
  });

  document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".shareBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  await App.ui?.shareEventFromButton?.(btn);

  });

  /* =========================
     EXPORT UI MODULE
  ========================= */
  App.ui = {
  ...(App.ui || {}),
  renderAppShell,
  renderList,
  renderEvents,
  renderNearbyEvents,
  renderTodayEvents,
  renderEventsIntoUl,
  renderCalendar,
  updateNearbyCount,

  bindLoginUI,
  bindPublicUI,
  bindAdminUI,
  bindCalendarUI,
  bindCategoryUI,
  bindDeleteEventUI,
  bindSidebarUI,
  shareEventFromButton,
  deleteEventFromButton,

  processQueuedDeepLink
};
})();