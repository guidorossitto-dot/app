//ui-calendar.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state, selectors } = App;

  /* =========================
     CATEGORY HTML HELPERS
  ========================= */


    async function shareEventFromButton(btn) {
    return await App.actions?.shareEventFlow?.({ button: btn });
  }

    async function deleteEventFromButton(btn) {
    return await App.actions?.deleteEventFlow?.({ button: btn });
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

  function formatYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function generateDailyOccurrences(baseEvent, startDate, endDate) {
    const out = [];

    if (!baseEvent || !startDate || !endDate) return out;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
    if (start > end) return out;

    const cur = new Date(start);

    while (cur <= end) {
      out.push({
        ...baseEvent,
        date: formatYMD(cur)
      });

      cur.setDate(cur.getDate() + 1);

      if (out.length > 60) break;
    }

    return out;
  }

  function renderGroupedList(ul, list) {
    if (!ul) return;
    ul.innerHTML = "";

    if (!list || list.length === 0) {
      ul.innerHTML = "<li>No hay eventos</li>";
      return;
    }

    const sortedInput = Array.isArray(list) ? [...list] : [];
const groups = groupByPlace(sortedInput);

    const renderEv = (ev) => {
      const time = util.formatTimeStart(ev);
const status = util.getEventStatus(ev);
const mins = util.minutesToStart(ev);

let soonBadge = "";

if (status) {
  if (mins !== null && mins >= 0 && mins <= 60) {
    soonBadge = `🔥 ${status}`;
  } else if (mins !== null && mins < 0 && Math.abs(mins) <= 20) {
    soonBadge = `🔴 ${status}`;
  } else {
    soonBadge = status;
  }
}

const icon = util.categoryEmoji(ev.category) || "📍";

      return `
        <article class="eventMiniCard eventMiniCard--${ev.category || "default"}">
          <div class="eventMiniCard__top">
            <div class="eventMiniCard__icon eventMiniCard__icon--${ev.category || "default"}" aria-hidden="true">${icon}</div>

            <div class="eventMiniCard__main">
              <div class="eventMiniCard__titleRow">
                ${
                  time
                    ? `<span class="eventMiniCard__time">${time}</span>`
                    : ""
                }

                <span class="eventMiniCard__title">${ev.title || "Evento"}</span>

                
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
  ${
    ev.link
      ? `<a class="linkBtn" href="${ev.link}" target="_blank" rel="noopener noreferrer">
          Ver info
        </a>`
      : ""
  }

  <button class="linkBtn favoriteBtn"
  data-eid="${encodeURIComponent(ev.id || "")}"
  aria-pressed="${App.events?.isFavorite?.(ev.id) ? "true" : "false"}">
  ${App.events?.isFavorite?.(ev.id) ? "❤️ Guardado" : "🤍 Guardar"}
</button>

  <button class="linkBtn routeBtn"
    data-lat="${ev.lat}"
    data-lng="${ev.lng}"
    data-place="${encodeURIComponent(ev.title || ev.placeName || "")}">
    Cómo llegar
  </button>

  <button class="linkBtn shareBtn"
  data-eid="${encodeURIComponent(ev.id)}"
  data-title="${encodeURIComponent(ev.title || "")}"
  data-place="${encodeURIComponent(util.shortPlaceName(ev.placeName) || "")}"
  data-date="${encodeURIComponent(ev.date || "")}"
  data-time="${encodeURIComponent(util.formatTimeStart(ev) || "")}"
  data-url="${
    (ev?.date || "").slice(0, 10) === util.todayStrYYYYMMDD()
      ? `${location.origin}${location.pathname}#e=${encodeURIComponent(ev.id || "")}`
      : `${location.origin}${location.pathname}#d=${encodeURIComponent(ev.date || "")}&e=${encodeURIComponent(ev.id || "")}`
  }">
  Compartir
</button>

  ${
    util.canManageUI()
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
      const evs = selectors.sortTodayEventsByUrgencyAndDistance
  ? selectors.sortTodayEventsByUrgencyAndDistance(g.events, state.logic.nearbyCenter)
  : g.events;
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
          <summary style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;font-weight:600;padding:10px 0;line-height:1.3">
            📍 ${placeTitle}
            <span style="opacity:.65;margin-left:4px">
              ${count} ${count === 1 ? "evento" : "eventos"}
            </span>
            ${badge ? `<span style="opacity:.7;font-size:.9em;margin-left:8px">${badge}</span>` : ""}
            </span>

<button class="linkBtn mapPlaceBtn"
  data-lat="${g.lat}"
  data-lng="${g.lng}"
  data-key="${g.key}"
  data-event-ids="${encodeURIComponent(JSON.stringify(evs.map(ev => ev.id).filter(Boolean)))}"
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

    const adminMode = !!util.isAdminMode();

    if (adminView) adminView.hidden = !util.canManageUI();

    if (!adminMode) {
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "none";
      return;
    }

if (loginBtn) {
  loginBtn.style.display = "";
}

if (logoutBtn) {
  logoutBtn.style.display = "";
}
  }

  /* =========================
     LISTAS
  ========================= */
  function renderEvents(list, emptyMsg = "No hay próximos eventos") {
  const ul = document.getElementById("eventList");
  if (!ul) return;

  const baseList = Array.isArray(list)
    ? list
    : selectors.getVisibleFutureEvents(state.logic.events || []);

  const today = util.todayStrYYYYMMDD();
  const maxDate = util.addDaysYYYYMMDD(today, 2);

  const safeList = (baseList || []).filter((ev) => {
    const d = String(ev.date || "").slice(0, 10);
    return d > today && d <= maxDate;
  });

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

function renderAgendaEvents() {
  const ul = document.getElementById("todayEvents");
  if (!ul) return;

  ul.innerHTML = "";

  const todayEvents = selectors.getSortedVisibleTodayEvents
    ? selectors.getSortedVisibleTodayEvents(state.logic.events || [], state.logic.nearbyCenter)
    : selectors.getVisibleTodayEvents(state.logic.events || []);

  if (!todayEvents.length) {
    ul.innerHTML = "<li>No hay eventos hoy. Mirá la agenda para próximos días.</li>";
    return;
  }

  const enriched = todayEvents.map((ev) => {
    if (
      state.logic.nearbyCenter &&
      util.isValidCoord(state.logic.nearbyCenter.lat) &&
      util.isValidCoord(state.logic.nearbyCenter.lng) &&
      util.isValidCoord(ev?.lat) &&
      util.isValidCoord(ev?.lng)
    ) {
      return {
        ...ev,
        distanceKm: util.distanceKm(
          state.logic.nearbyCenter.lat,
          state.logic.nearbyCenter.lng,
          Number(ev.lat),
          Number(ev.lng)
        )
      };
    }

    return ev;
  });

  renderGroupedList(ul, enriched);
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

          <button class="linkBtn favoriteBtn"
  data-eid="${encodeURIComponent(ev.id || "")}"
  aria-pressed="${App.events?.isFavorite?.(ev.id) ? "true" : "false"}">
  ${App.events?.isFavorite?.(ev.id) ? "❤️ Guardado" : "🤍 Guardar"}
</button>
  <button class="linkBtn mapPlaceBtn"
  data-lat="${ev.lat}"
  data-lng="${ev.lng}"
  data-key="${locationKey}"
  data-event-ids="${encodeURIComponent(JSON.stringify([ev.id].filter(Boolean)))}"
  type="button">
  Ver en mapa
</button>

  ${
    ev.link
      ? `<a class="linkBtn" href="${ev.link}" target="_blank" rel="noopener noreferrer">
          Ver info
        </a>`
      : ""
  }

  <button class="linkBtn routeBtn"
    data-lat="${ev.lat}"
    data-lng="${ev.lng}"
    data-place="${encodeURIComponent(ev.title || ev.placeName || "")}">
    Cómo llegar
  </button>

<button class="linkBtn shareBtn"
  data-eid="${encodeURIComponent(ev.id || "")}"
  data-title="${encodeURIComponent(ev.title || "")}"
  data-place="${encodeURIComponent(util.shortPlaceName(ev.placeName) || "")}"
  data-date="${encodeURIComponent(ev.date || "")}"
  data-time="${encodeURIComponent(util.formatTimeStart(ev) || "")}"
  data-url="${
    (ev?.date || "").slice(0, 10) === util.todayStrYYYYMMDD()
      ? `${location.origin}${location.pathname}#e=${encodeURIComponent(ev.id || "")}`
      : `${location.origin}${location.pathname}#d=${encodeURIComponent(ev.date || "")}&e=${encodeURIComponent(ev.id || "")}`
  }">
  Compartir
</button>

  ${
    util.canManageUI()
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

  let featuredList = selectors.getFeaturedNearbyEvents(list || []);

  if (!featuredList.length) {
    if (topEl) topEl.innerHTML = "";
    return;
  }

  const cat = state.logic.activeCategory || "all";
  const catChip = cat === "all" ? "" : `<span class="miniChip">${util.categoryLabel(cat)}</span>`;

  featuredList = [...featuredList];

  if (!featuredList.length) {
    const visibleToday = selectors.getVisibleTodayEvents(state.logic.events || []);

    featuredList = [...visibleToday]
      .filter((ev) => selectors.isFeaturedEvent(ev))
      .sort((a, b) => selectors.getFeaturedRank(a) - selectors.getFeaturedRank(b));
  }

  const mainFeatured = featuredList[0] || null;
  const extraFeatured = featuredList.slice(1);

  function renderFeaturedCard(featured) {
    const featuredStatus = util.getEventStatus(featured);
    const featuredPlace = util.shortPlaceName(featured.placeName) || "Lugar sin nombre";
    const featuredKey = util.smartLocationKey(featured, state.logic.events || []);
    const featuredEmoji = util.categoryEmoji(featured.category) || "📍";

    return `
      <div class="featuredBox">
        <div class="featuredTop">
          <div class="featuredKicker">
            <span>DESTACADO</span>
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
          <span style="margin-right:6px">${featuredEmoji}</span>
          ${util.formatTimeStart(featured) ? `<span style="opacity:.75;margin-right:6px">${util.formatTimeStart(featured)}</span>` : ""}
          ${featured.title}
        </div>

        <div class="featuredMeta">
          ${featuredStatus ? `<span style="opacity:.75">🔥 ${featuredStatus}</span>` : ""}
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

  if (topEl) {
    topEl.innerHTML = `
      <div class="featuredFloating">
        <button id="featuredToggleBtn" class="featuredToggleBtn" aria-expanded="false">
          🔥 Comienza pronto
        </button>

        <div id="featuredDropdown" class="featuredDropdown" hidden>
          ${featuredHTML}
        </div>
      </div>
    `;
  }

  bindFeaturedToggle();
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
        const dayEvents = selectors.getVisibleEventsOnDate(focus.dateStr, state.logic.events || []);

      if (focus.dateStr === today) {
        return {
          todayList: dayEvents,
          todayEmpty: "No hay eventos hoy",
          futureList: [],
          futureEmpty: "No hay próximos eventos"
        };
      }

      if (focus.dateStr > today) {
        return {
          todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
          todayEmpty: "No hay eventos hoy",
          futureList: dayEvents,
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
        todayList: selectors.applyBaficiFilter
            ? selectors.applyBaficiFilter(util.filterByActiveCategory([ev]))
           : util.filterByActiveCategory([ev]),
            todayEmpty: "No hay eventos hoy",
          futureList: [],
          futureEmpty: "No hay próximos eventos"
        };
      }

      if (dateStr > today) {
        return {
          todayList: selectors.getVisibleTodayEvents(state.logic.events || []),
          todayEmpty: "No hay eventos hoy",
        futureList: selectors.applyBaficiFilter
          ? selectors.applyBaficiFilter(util.filterByActiveCategory([ev]))
          : util.filterByActiveCategory([ev]),
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

  function closeFeaturedDropdown() {
  const dropdown = document.getElementById("featuredDropdown");
  const toggleBtn = document.getElementById("featuredToggleBtn");

  if (dropdown && !dropdown.hidden) {
    dropdown.hidden = true;
    toggleBtn?.setAttribute("aria-expanded", "false");
  }
}

  function bindFeaturedToggle() {
  const toggleBtn = document.getElementById("featuredToggleBtn");
  const dropdown = document.getElementById("featuredDropdown");

  if (!toggleBtn || !dropdown) return;

  function setState(open) {
    dropdown.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
    toggleBtn.textContent = open
      ? "🔥 Comienza pronto ▴"
      : "🔥 Comienza pronto ▾";
  }

  toggleBtn.onclick = () => {
    const isOpen = !dropdown.hidden;
    setState(!isOpen);
  };

  document.addEventListener("click", (e) => {
    const wrapper = document.querySelector(".featuredFloating");
    if (!wrapper) return;

    if (!wrapper.contains(e.target)) {
      setState(false);
    }
  });

  // estado inicial
  setState(false);
}

 function renderList() {
  renderAgendaEvents();
  updateNearbyCount(state.logic.nearbyEvents);
}

  /* =========================
     CALENDARIO
  ========================= */

function isMobileSidebarMode() {
  return window.innerWidth <= 1100;
}

function closeSidebarMobileIfOpen() {
  const sidebar = document.getElementById("leftSidebar");
  const btn = document.getElementById("toggleSidebarBtn");
  if (!sidebar || !btn) return;
  if (!isMobileSidebarMode()) return;

  const wasOpen = sidebar.classList.contains("is-open");
  if (!wasOpen) return;

  sidebar.classList.remove("is-open");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "☰ Agenda";
  btn.title = "Abrir agenda";

  const map = App.state?.runtime?.map;
  if (map) {
    setTimeout(() => map.invalidateSize(), 220);
  }
}


  function bindSidebarUI() {
  const layout = document.querySelector(".appLayout--leftSidebar");
  const sidebar = document.getElementById("leftSidebar");
  const btn = document.getElementById("toggleSidebarBtn");
  if (!layout || !btn || !sidebar) return;

  const STORAGE_KEY = "leftSidebarCollapsed";

  function isMobileMode() {
    return window.innerWidth <= 1100;
  }

  function invalidateMapSoon() {
    if (!state.runtime.map) return;

    setTimeout(() => {
      const map = App.state.runtime.map;
      if (!map) return;

      map.invalidateSize();

      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }, 220);
  }

  function applyDesktopState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const startsCollapsed = saved === "true";

    sidebar.classList.remove("is-open");

    if (startsCollapsed) {
      layout.classList.add("isCollapsed");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
      btn.title = "Expandir agenda";
    } else {
      layout.classList.remove("isCollapsed");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "☰ Agenda";
      btn.title = "Contraer agenda";
    }
  }

  function applyMobileState() {
    layout.classList.remove("isCollapsed");
    sidebar.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "☰ Agenda";
    btn.title = "Abrir agenda";
  }

  function syncMode() {
    if (isMobileMode()) {
      applyMobileState();
    } else {
      applyDesktopState();
    }
  }

  syncMode();

  btn.addEventListener("click", () => {
    if (isMobileMode()) {
      const isOpen = sidebar.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      btn.textContent = "☰ Agenda";
      btn.title = isOpen ? "Cerrar agenda" : "Abrir agenda";
      invalidateMapSoon();
      return;
    }

    const collapsed = layout.classList.toggle("isCollapsed");
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.textContent = collapsed ? "☰" : "☰ Agenda";
    btn.title = collapsed ? "Expandir agenda" : "Contraer agenda";
    localStorage.setItem(STORAGE_KEY, String(collapsed));
    invalidateMapSoon();
  });

  window.addEventListener("resize", syncMode);
}

function paintCategoryUI() {
  const row = document.getElementById("categoryChips");
  if (!row) return;

  const chips = [...row.querySelectorAll(".chip[data-cat]")];
  const favChip = document.getElementById("favoritesOnlyChip");

  chips.forEach((btn) => {
    const on = btn.dataset.cat === (state.logic.activeCategory || "all");
    btn.classList.toggle("isActive", on);
  });

  if (favChip) {
    const favs = Array.isArray(state.logic.favorites) ? state.logic.favorites : [];
    const count = favs.length;

    favChip.classList.toggle("isActive", !!state.logic.favoritesOnly);
    favChip.textContent = count > 0 ? `❤️ Favoritos (${count})` : "❤️ Favoritos";
  }
}



function closeMapFiltersPanel() {
  const btn = document.getElementById("toggleMapFiltersBtn");
  const panel = document.getElementById("mapFiltersPanel");

  if (panel) panel.hidden = true;

  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "🎛️ Filtros ▾";
  }
}

function forceMapRefresh() {
  try {
    App.state?.runtime?.markerCluster?.refreshClusters?.();
  } catch {}

  try {
    App.state?.runtime?.map?.invalidateSize?.();
  } catch {}

  requestAnimationFrame(() => {
    try {
      App.state?.runtime?.markerCluster?.refreshClusters?.();
    } catch {}

    try {
      App.state?.runtime?.map?.panBy?.([0, 0], { animate: false });
    } catch {}
  });
}

function bindCategoryUI() {
  const row = document.getElementById("categoryChips");
  if (!row || row.dataset.bound === "1") {
    paintCategoryUI();
    return;
  }

  row.dataset.bound = "1";

  const chips = [...row.querySelectorAll(".chip[data-cat]")];
  const favChip = document.getElementById("favoritesOnlyChip");

  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      App.actions?.selectCategory?.(btn.dataset.cat || "all");
      clearListFocus?.();
      paintCategoryUI();

      App.commit?.({
        persist: false,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });

      closeMapFiltersPanel();
      forceMapRefresh();
    });
  });

  if (favChip) {
    favChip.addEventListener("click", () => {
      App.actions?.toggleFavoritesOnly?.();
      clearListFocus?.();
      paintCategoryUI();

      commit?.({
        persist: false,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });

      closeMapFiltersPanel();
      forceMapRefresh();
    });
  }

  paintCategoryUI();
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

      App.actions?.focusPlaceOnMapFlow?.({ button: btn });
    });

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".favoriteBtn");
  if (!btn) return;

  if (
    btn.closest("#calendarEventPopover") ||
    btn.closest(".leaflet-popup-content")
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
  if (!eventId) return;

  const result = App.actions?.toggleFavorite?.(eventId);
  if (!result?.ok) return;

  App.ui?.syncFavoriteUI?.(eventId, !!result.isFavorite);
});
  }

    function bindAdminSaveUI() {
    const addBtn = document.getElementById("addEventBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", async () => {
      if (!util.canManageUI()) {
        alert("No tenés permisos para cargar eventos.");
        return;
      }

      await App.adminForm?.createEventFromAdminForm?.();
    });
  }

function bindAdminBulkActionsUI() {
  const approveCandidatesBtn = document.getElementById("approveCandidatesBtn");
  const clearBtn = document.getElementById("clearEventsBtn");
  const clearPastBtn = document.getElementById("clearPastEventsBtn");

   if (approveCandidatesBtn) {
  approveCandidatesBtn.addEventListener("click", async () => {
    if (!util.canManageUI()) {
      alert("No tenés permisos para aprobar candidatos.");
      return;
    }

    approveCandidatesBtn.disabled = true;
    approveCandidatesBtn.textContent = "Aprobando...";

    const result = await App.actions?.approveAllPendingCandidatesFlow?.();

    approveCandidatesBtn.disabled = false;
    approveCandidatesBtn.textContent = "Aprobar pendientes";

    if (!result?.ok && !result?.summary?.length) {
      alert("No se pudieron aprobar los candidatos.");
      return;
    }

    const lines = (result.summary || []).map((item) => {
      return `${item.source}: aprobados ${item.approvedCount || 0}, salteados ${item.skippedCount || 0}`;
    });

    alert(
      `Aprobación terminada.\n\n` +
      `${lines.join("\n")}\n\n` +
      `Total aprobados: ${result.totalApproved || 0}\n` +
      `Total salteados: ${result.totalSkipped || 0}`
    );

    // 🔥 refrescar lista de skipped (nuevo)
    if (App.ui?.renderSkippedCandidatesList) {
      await App.ui.renderSkippedCandidatesList("alternativa");
    }
  });
}

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (!util.canManageUI()) {
          alert("No tenés permisos para borrar eventos.");
          return;
        }

        App.map?.clearAllEvents?.();
      });
    }

    if (clearPastBtn) {
      clearPastBtn.addEventListener("click", async () => {
        if (!util.canManageUI()) {
          alert("No tenés permisos para borrar eventos.");
          return;
        }

        const confirmDelete = confirm("¿Seguro que querés borrar todos los eventos pasados?");
        if (!confirmDelete) return;

        const result = await App.events?.clearPastEvents?.();

        if (!result?.ok) {
          alert("No se pudieron borrar los eventos pasados.");
          return;
        }

        alert(`Se borraron ${result.deletedCount || 0} eventos pasados.`);

        App.commit?.({
          persist: false,
          purgePast: false,
          rebuildMarkers: true,
          recomputeNearby: true
        });
      });
    }
  }

  function bindSkippedCandidatesUI() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".useCandidateVenueBtn");
    if (!btn) return;

    if (!util.canManageUI()) {
      alert("No tenés permisos para gestionar venues.");
      return;
    }

    try {
      const raw = decodeURIComponent(btn.dataset.candidate || "");
      const candidate = JSON.parse(raw);

      const result = applyCandidateVenueToAdmin(candidate);
      if (!result?.ok) return;
    } catch (err) {
      console.error("No se pudo aplicar candidate al admin form.", err);
      alert("No se pudo cargar el candidate en el formulario.");
    }
  });

  document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".deleteSkippedCandidateBtn");
  if (!btn) return;

  if (!util.canManageUI()) {
    alert("No tenés permisos para borrar candidates.");
    return;
  }

  const candidateId = decodeURIComponent(btn.dataset.candidateId || "");
  const candidateTitle = decodeURIComponent(btn.dataset.candidateTitle || "");

  if (!candidateId) return;

  const confirmed = confirm(
    candidateTitle
      ? `¿Seguro que querés borrar el candidate "${candidateTitle}"?`
      : "¿Seguro que querés borrar este candidate?"
  );

  if (!confirmed) return;

  const result = await App.actions?.deleteSkippedCandidateFlow?.(candidateId);

  if (!result?.ok) {
    alert("No se pudo borrar el candidate.");
    return;
  }

  if (App.ui?.renderSkippedCandidatesList) {
    await App.ui.renderSkippedCandidatesList("alternativa");
  }
});
}


  function bindAdminCancelUI() {
    const cancelBtn = document.getElementById("cancelEditBtn");
    if (!cancelBtn) return;

    cancelBtn.addEventListener("click", () => {
      if (!util.canManageUI()) {
        alert("No tenés permisos para editar eventos.");
        return;
      }

      App.adminForm?.resetAdminEventForm?.();
    });
  }

  function bindAdminVenueSearchUI() {
    const venueSearchInput = document.getElementById("venueSearchInput");
    if (!venueSearchInput) return;

    venueSearchInput.addEventListener("input", (e) => {
      if (!util.canManageUI()) {
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

 async function renderSkippedCandidatesList(sourceName = "alternativa") {
  const ul = document.getElementById("skippedCandidatesList");
  if (!ul) return;

  ul.innerHTML = "<li>Cargando...</li>";

  const result = await App.candidates?.getApprovableCandidatesBySource?.(sourceName);

  if (!result?.ok) {
    ul.innerHTML = "<li>No se pudieron cargar los candidates salteados.</li>";
    return;
  }

  const skipped = Array.isArray(result.skippedCandidates) ? result.skippedCandidates : [];

  if (!skipped.length) {
    ul.innerHTML = "<li>No hay candidates salteados.</li>";
    return;
  }

  ul.innerHTML = skipped.map((candidate) => {
    const encoded = encodeURIComponent(JSON.stringify({
      id: candidate.id || "",
      title: candidate.title || "",
      venueName: candidate.venueName || "",
      date: candidate.date || "",
      startTime: candidate.startTime || ""
    }));

    return `
      <li class="eventListItem">
        <div class="eventCard">
          <div class="eventCardMain">
            <div class="eventCardTitleWrap">
              <div class="eventCardTitle">${candidate.title || "Sin título"}</div>
              <div class="eventCardMeta">
                ${candidate.date ? `<span>${App.util.formatDateDisplay(candidate.date)}</span>` : ""}
                ${candidate.startTime ? `<span>${candidate.startTime}</span>` : ""}
              </div>
              <div class="eventCardPlace">${candidate.venueName || "Venue sin nombre"}</div>
            </div>

           <div class="eventCardActions">
  <button
    type="button"
    class="linkBtn useCandidateVenueBtn"
    data-candidate='${encoded}'
  >
    Usar venue
  </button>

  <button
    type="button"
    class="linkBtn deleteSkippedCandidateBtn"
    data-candidate-id="${encodeURIComponent(candidate.id || "")}"
    data-candidate-title="${encodeURIComponent(candidate.title || "")}"
  >
    Borrar
  </button>
</div>
          </div>
        </div>
      </li>
    `;
  }).join("");
}

function applyCandidateVenueToAdmin(candidate) {
  if (!candidate) return { ok: false, error: "MISSING_CANDIDATE" };

  const safeVenue = String(candidate.venueName || "").trim();
  const safeTitle = String(candidate.title || "").trim();
  const safeDate = String(candidate.date || "").trim();
  const safeStart = String(candidate.startTime || "").trim();

  const eventPlace = document.getElementById("eventPlace");
  const venueSearchInput = document.getElementById("venueSearchInput");
  const placeQuery = document.getElementById("placeQuery");
  const eventTitle = document.getElementById("eventTitle");
  const eventDate = document.getElementById("eventDate");
  const eventStart = document.getElementById("eventStart");

  if (eventPlace) eventPlace.value = safeVenue;
  if (venueSearchInput) venueSearchInput.value = safeVenue;
  if (placeQuery) placeQuery.value = safeVenue;

  if (eventTitle) eventTitle.value = safeTitle;
  if (eventDate) eventDate.value = safeDate;
  if (eventStart) eventStart.value = safeStart;

  App.state.logic = App.state.logic || {};
  App.state.logic.selectedCandidateId = String(candidate.id || "").trim();

  const placeSection = document.getElementById("placeQuery");
  if (placeSection) {
    placeSection.scrollIntoView({ behavior: "smooth", block: "center" });
    placeSection.focus();
  }

  return {
    ok: true,
    candidateId: String(candidate.id || "").trim(),
    venueName: safeVenue
  };
}

async function saveVenueForSelectedCandidate() {
  const selectedCandidateId = String(App.state.logic?.selectedCandidateId || "").trim();
  if (!selectedCandidateId) {
    alert("Primero elegí un candidate con “Usar venue”.");
    return { ok: false, error: "MISSING_SELECTED_CANDIDATE" };
  }

  const placeInput = document.getElementById("eventPlace");
  const latInput = document.getElementById("eventLat");
  const lngInput = document.getElementById("eventLng");

  const name = String(placeInput?.value || "").trim();
  const lat = Number(latInput?.value);
  const lng = Number(lngInput?.value);

  if (!name) {
    alert("Falta el nombre del venue.");
    return { ok: false, error: "MISSING_VENUE_NAME" };
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    alert("Primero buscá y elegí el lugar real para obtener coordenadas.");
    return { ok: false, error: "MISSING_COORDS" };
  }

  const result = await App.venues?.addVenueRemote?.({
    name,
    address: name,
    lat,
    lng
  });

  if (!result?.ok) {
    alert("No se pudo guardar el venue.");
    return { ok: false, error: result?.error || "SAVE_VENUE_FAILED" };
  }

  if (App.venues?.loadVenuesRemote) {
    await App.venues.loadVenuesRemote();
  }

  if (App.ui?.renderSkippedCandidatesList) {
    await App.ui.renderSkippedCandidatesList("alternativa");
  }

  alert(`Venue guardado: ${name}`);

  return {
    ok: true,
    candidateId: selectedCandidateId,
    venueName: name
  };
}

    function bindAdminUI() {
    bindAdminSaveUI();
    bindAdminBulkActionsUI();
    bindAdminCancelUI();
    bindAdminVenueSearchUI();
    bindSkippedCandidatesUI();
    bindSaveCandidateVenueUI();
    renderSkippedCandidatesList("alternativa");
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

  function bindSaveCandidateVenueUI() {
  const btn = document.getElementById("saveCandidateVenueBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!util.canManageUI()) {
      alert("No tenés permisos para guardar venues.");
      return;
    }

    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Guardando...";

    try {
      await saveVenueForSelectedCandidate();
    } finally {
      btn.disabled = false;
      btn.textContent = prev || "Guardar venue para candidate";
    }
  });
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

    if (!util.canManageUI()) {
      alert("No tenés permisos para editar eventos.");
      return;
    }

    const venueId = btn.dataset.venueId;
    const result = App.venues?.selectVenueForAdmin?.(venueId);
    if (!result?.ok) return;

    applyVenueToAdminForm(result.venue);
  });

  const createModeEl = document.getElementById("eventCreateMode");
  const endDateEl = document.getElementById("eventEndDate");
  const endDateLabelEl = document.getElementById("eventEndDateLabel");

  function syncCreateModeUI() {
  const mode = createModeEl?.value || "single";
  const showEndDate = mode === "dailyRange" || mode === "weeklyRange";

  if (endDateEl) endDateEl.hidden = !showEndDate;
  if (endDateLabelEl) endDateLabelEl.hidden = !showEndDate;
}

  if (createModeEl) {
    createModeEl.addEventListener("change", syncCreateModeUI);
    syncCreateModeUI();
  }

  /* =========================
     DEEP LINK (#e=EVENT_ID)
  ========================= */
    function queueDeepLinkFromHash() {
  const h = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  const hasDate = !!(params.get("d") || "").trim();

  if (hasDate) {
    return { ok: false, error: "CALENDAR_DEEP_LINK_TAKES_PRIORITY" };
  }

  return App.actions?.queueDeepLinkFromHashFlow?.();
}

    function processQueuedDeepLink() {
    return App.actions?.processQueuedDeepLinkFlow?.();
  }

  /* =========================
     LISTENERS DE HASH
  ========================= */
document.addEventListener("DOMContentLoaded", () => {
  const h = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  const hasDate = !!(params.get("d") || "").trim();

  if (hasDate) {
    App.actions?.queueCalendarDateFromHashFlow?.();
    return;
  }

  queueDeepLinkFromHash();
});

window.addEventListener("hashchange", () => {
  const h = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  const hasDate = !!(params.get("d") || "").trim();

  if (hasDate) {
    App.actions?.queueCalendarDateFromHashFlow?.();
    App.actions?.processQueuedCalendarDateFlow?.();
    return;
  }

  queueDeepLinkFromHash();
  processQueuedDeepLink();
});

    document.addEventListener("click", (e) => {
    const btn = e.target.closest(".mapFocusBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    
     closeFeaturedDropdown();

    App.actions?.focusEventOnMapFlow?.({ button: btn });
  });

    document.addEventListener("click", (e) => {
    const btn = e.target.closest(".routeBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    App.actions?.routeToEventFlow?.({ button: btn });
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".shareBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    await App.ui?.shareEventFromButton?.(btn);
  });

 function syncFavoriteUI(eventId, isFavorite) {
  const safeId = String(eventId || "").trim();
  if (!safeId) return;

  // 1) Botones visibles de favorito
  document
    .querySelectorAll(".favoriteBtn, .calendarDayPopoverFavoriteBtn")
    .forEach((btn) => {
      const rawId = btn.dataset.eid || btn.dataset.favEid || "";
      const btnId = decodeURIComponent(String(rawId).trim());
      if (btnId !== safeId) return;

      btn.setAttribute("aria-pressed", isFavorite ? "true" : "false");
      btn.textContent = isFavorite ? "❤️ Guardado" : "🤍 Guardar";
    });

  // 2) Mini eventos visibles en el calendario (desktop)
  document.querySelectorAll(".event[data-eid]").forEach((el) => {
    const elId = String(el.dataset.eid || "").trim();
    if (elId !== safeId) return;

    el.classList.toggle("event--favorite", !!isFavorite);

    // Guardamos el texto base una sola vez, sin corazón inicial
    if (!el.dataset.baseTitle) {
      el.dataset.baseTitle = (el.textContent || "").replace(/^❤️\s*/, "").trim();
    }

    el.textContent = isFavorite
      ? `❤️ ${el.dataset.baseTitle}`
      : el.dataset.baseTitle;
  });

  // 3) Estado visual de cada día del calendario
  document.querySelectorAll(".day").forEach((dayEl) => {
    const hasFav = !!dayEl.querySelector(".event.event--favorite");
    dayEl.classList.toggle("day--hasFavorite", hasFav);
  });

  // 4) Chip / contador de favoritos
  App.ui?.paintCategoryUI?.();
}

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
    updateNearbyCount,

    bindPublicUI,
    bindAdminUI,
    bindCategoryUI,
    paintCategoryUI,
    bindDeleteEventUI,
    bindSidebarUI,
    shareEventFromButton,
    deleteEventFromButton,

    setListFocus,
    clearListFocus,
    saveVenueForSelectedCandidate,
renderSkippedCandidatesList,
closeSidebarMobileIfOpen,
applyCandidateVenueToAdmin, 
    renderSkippedCandidatesList,
    applyCandidateVenueToAdmin,
    syncFavoriteUI,
    processQueuedDeepLink
  };
})();