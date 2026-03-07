(() => {
  "use strict";

  const App = window.App;
  const { util, state, storage, selectors } = App;

  /* =========================
     CATEGORY HTML HELPERS
  ========================= */
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

      return `
        <div style="padding:6px 0;border-top:1px solid #eee">
          <div style="font-weight:600">
            ${time ? `<span style="opacity:.75;margin-right:6px">${time}</span>` : ""}
            ${ev.title}${categoryTagHTML(ev)}
            ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
          </div>

          <div style="opacity:.75;font-size:.9em">
            ${util.formatDateDisplay(ev.date)}
          </div>

          <div style="margin-top:4px;display:flex;gap:10px;font-size:.85em;align-items:center;flex-wrap:wrap">
            <button class="linkBtn"
              data-lat="${ev.lat}"
              data-lng="${ev.lng}"
              data-key="${util.smartLocationKey(ev, state.events || [])}">
              Ver en mapa
            </button>

            <button class="linkBtn shareBtn"
              data-eid="${encodeURIComponent(ev.id)}"
              data-title="${encodeURIComponent(ev.title || "")}">
              Compartir
            </button>

            ${
              state.isLoggedIn
                ? `<button class="linkBtn deleteEventBtn"
                    data-delete-eid="${encodeURIComponent(ev.id)}"
                    data-delete-title="${encodeURIComponent(ev.title || "")}">
                    Borrar
                  </button>`
                : ""
            }
          </div>
        </div>
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
                <div style="font-weight:500">${placeTitle}</div>
                ${badge ? `<div style="opacity:.7;font-size:.9em;margin-top:2px">${badge}</div>` : ""}
              </div>
              <button class="linkBtn"
                data-lat="${g.lat}"
                data-lng="${g.lng}"
                data-key="${g.key}">
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
          <summary style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span>
              <span style="font-weight:500">${placeTitle}</span>
              <span style="opacity:.65"> · ${count} ${count === 1 ? "evento" : "eventos"}</span>
              ${badge ? `<span style="opacity:.7;font-size:.9em;margin-left:8px">${badge}</span>` : ""}
            </span>

            <button class="linkBtn"
              data-lat="${g.lat}"
              data-lng="${g.lng}"
              data-key="${g.key}"
              style="margin-left:auto">
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

    if (adminView) adminView.hidden = !state.isLoggedIn;
    if (loginBtn) loginBtn.hidden = state.isLoggedIn;
    if (logoutBtn) logoutBtn.hidden = !state.isLoggedIn;
  }

  /* =========================
     LISTAS
  ========================= */
  function renderEvents(list = state.events) {
    const ul = document.getElementById("eventList");
    if (!ul) return;

    const onlyFuture = util.filterByActiveCategory(util.getFutureEvents(list));

    if (!onlyFuture || onlyFuture.length === 0) {
      ul.innerHTML = "<li>No hay próximos eventos</li>";
      return;
    }

    renderGroupedList(ul, onlyFuture);
  }

  function renderNearbyEvents(list = state.nearbyEvents) {
    const ul = document.getElementById("nearbyList");
    if (!ul) return;

    if (!list || list.length === 0) {
      ul.innerHTML = "<li>No hay eventos a 2 km</li>";
      return;
    }

    renderGroupedList(ul, list);
  }

  function renderTodayEvents(list = state.events) {
    const ul = document.getElementById("todayEvents");
    if (!ul) return;

    const todayEvents = util.filterByActiveCategory(util.getTodayEvents(list));

    if (!todayEvents || todayEvents.length === 0) {
      ul.innerHTML = "<li>No hay eventos hoy</li>";
      return;
    }

    renderGroupedList(ul, todayEvents);
  }

  function renderEventsIntoUl(ulId, list, emptyMsg) {
    const ul = document.getElementById(ulId);
    if (!ul) return;
    ul.innerHTML = "";

    const filtered = util.filterByActiveCategory(list || []);

    if (!filtered || filtered.length === 0) {
      ul.innerHTML = `<li>${emptyMsg || "No hay eventos"}</li>`;
      return;
    }

    const sorted = [...filtered].sort(util.sortEventsByStatusThenTime);

    sorted.forEach((ev) => {
      const time = util.formatTimeStart(ev);
      const status = util.getEventStatus(ev);

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="eventItem">
          <div class="eventDate">${util.formatDateDisplay(ev.date)}</div>
          <div class="eventMain">
            <div class="eventTitle">
              ${time ? `<span style="opacity:.75;margin-right:6px">${time}</span>` : ""}
              ${ev.title}${categoryTagHTML(ev)}
              ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
            </div>
            <div class="eventPlace">
              ${ev.placeName ? `<div>${util.shortPlaceName(ev.placeName)}</div>` : ""}
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <button class="linkBtn"
                  data-lat="${ev.lat}"
                  data-lng="${ev.lng}"
                  data-key="${util.smartLocationKey(ev, state.events || [])}">
                  Ver en mapa
                </button>

                <button class="linkBtn shareBtn"
                  data-eid="${encodeURIComponent(ev.id)}"
                  data-title="${encodeURIComponent(ev.title || "")}">
                  Compartir
                </button>

                ${
                  state.isLoggedIn
                    ? `<button class="linkBtn deleteEventBtn"
                        data-delete-eid="${encodeURIComponent(ev.id)}"
                        data-delete-title="${encodeURIComponent(ev.title || "")}">
                        Borrar
                      </button>`
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      `;
      ul.appendChild(li);
    });
  }

  function updateNearbyCount(list = state.nearbyEvents) {
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

    const cat = state.activeCategory || "all";
    const catChip = cat === "all" ? "" : `<span class="miniChip">${util.categoryLabel(cat)}</span>`;

    function safeMinutesToStart(ev) {
      const min = util.minutesToStart(ev);
      return Number.isFinite(min) ? min : null;
    }

    function featuredRank(ev) {
      const m = safeMinutesToStart(ev);
      if (m === null) return 999999;
      if (m <= 0 && m > -180) return Math.abs(m) / 1000;
      if (m > 0 && m <= 60) return 10 + m;
      if (m > 60) return 100 + m;
      return 900000 + Math.abs(m);
    }

    const featured = [...todayList].sort((a, b) => featuredRank(a) - featuredRank(b))[0];
    const featuredStatus = featured ? util.getEventStatus(featured) : "";
    const featuredPlace = featured ? util.shortPlaceName(featured.placeName) || "Lugar sin nombre" : "";
    const featuredKey = featured ? util.smartLocationKey(featured, state.events || []) : "";

    const featuredHTML = featured
      ? `
        <div class="featuredBox">
          <div class="featuredTop">
            <div class="featuredKicker">DESTACADO ${catChip ? "· " + catChip : ""}</div>
            <button class="linkBtn"
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

  function renderList() {
    renderTodayEvents();
    renderEvents();
    renderNearbyEvents(state.nearbyEvents);
    updateNearbyCount(state.nearbyEvents);
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
    const visible = util.filterByActiveCategory(state.events || []);

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

    pop.innerHTML = `
      <div class="calendarEventPopover__title">${ev.title || "Evento"}</div>
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

        const key = util.smartLocationKey(ev, state.events || []);
        const loc = state.locationMarkers?.[key];

        if (App.map?.focusEventById && ev.id) {
          App.map.focusEventById(ev.id);
          return;
        }

        if (state.map && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
          state.map.setView([ev.lat, ev.lng], 16);
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

                return `
                  <div class="calendarDayPopover__item">
                    <div class="calendarDayPopover__itemTitle">
                      ${ev.title || "Evento"}
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
    const dayEvents = util.getEventsOnDate(dateStr, state.events);
    const today = util.todayStrYYYYMMDD();

    if (anchorEl) {
      showCalendarDayPopover(anchorEl, dateStr, dayEvents);
      return;
    }

    removeCalendarPopover();

    if (dateStr === today) {
      renderEventsIntoUl("todayEvents", dayEvents, "No hay eventos hoy");
    } else if (dateStr > today) {
      renderEventsIntoUl("eventList", dayEvents, "No hay eventos ese día");
    } else {
      renderEventsIntoUl("eventList", [], "Ese día ya pasó");
    }
  }

    function renderCalendar() {
    const cal = document.getElementById("calendar");
    const label = document.getElementById("monthLabel");
    if (!cal) return;

    removeCalendarPopover();
    cal.innerHTML = "";

    const year = state.calendarCursor.getFullYear();
    const month = state.calendarCursor.getMonth();

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

      evs.slice(0, 3).forEach((ev) => {
        const b = document.createElement("div");
        b.className = "event";
        b.textContent = ev.title;
        b.dataset.eid = ev.id || "";

        b.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showCalendarEventPopover(b, ev);
        });

        cell.appendChild(b);
      });

            if (evs.length > 3) {
        const more = document.createElement("div");
        more.className = "event event-more";
        more.textContent = `+${evs.length - 3} más`;

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

      if (state.map) {
        setTimeout(() => {
          state.map.invalidateSize();
        }, 240);
      }
    });
  }

  function bindCalendarUI() {
    const prevMonthBtn = document.getElementById("prevMonthBtn");
    const nextMonthBtn = document.getElementById("nextMonthBtn");

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        state.calendarCursor = new Date(
          state.calendarCursor.getFullYear(),
          state.calendarCursor.getMonth() - 1,
          1
        );
        renderCalendar();
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        state.calendarCursor = new Date(
          state.calendarCursor.getFullYear(),
          state.calendarCursor.getMonth() + 1,
          1
        );
        renderCalendar();
      });
    }
  }

  /* =========================
     CORE: renderAll + commit
  ========================= */
  function renderAll(opts = {}) {
    const {
      rebuildMarkers = true,
      recomputeNearby = true
    } = opts;

    if (recomputeNearby && state.nearbyCenter && App.map?.recomputeNearbyEvents) {
      App.map.recomputeNearbyEvents(state.nearbyCenter.lat, state.nearbyCenter.lng);
    }

    renderAppShell();
    renderList();
    renderCalendar();

    if (App.map?.renderMap) {
      App.map.renderMap({ rebuildMarkers });
    }
  }

  function commit(opts = {}) {
    storage.purgePastEvents();
    storage.saveEvents();
    renderAll(opts);
  }

  /* =========================
     BIND: login + public + admin
  ========================= */
  function bindLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        state.isLoggedIn = true;
        storage.saveLoginState();

        if (state.map) state.map.closePopup();

        renderAll({ rebuildMarkers: true, recomputeNearby: true });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        state.isLoggedIn = false;
        storage.saveLoginState();

        if (state.map) state.map.closePopup();

        App.map?.clearEventCreationMarker?.();
        renderAll({ rebuildMarkers: true, recomputeNearby: true });
      });
    }
  }

  function bindPublicUI() {
    const autoBtn = document.getElementById("autoLocationBtn");
    const searchBtn = document.getElementById("searchNearbyBtn");

    if (autoBtn) autoBtn.addEventListener("click", () => App.map?.useMyLocation?.());

    if (searchBtn && !searchBtn.classList.contains("debugHidden")) {
      searchBtn.addEventListener("click", () => App.map?.searchNearbyFromInputs?.());
    }
  }

  function bindDeleteEventUI() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".deleteEventBtn");
      if (!btn) return;

      const eventId = decodeURIComponent((btn.dataset.deleteEid || "").trim());
      if (!eventId) return;

      const title = decodeURIComponent((btn.dataset.deleteTitle || "").trim());
      const msg = title
        ? `¿Seguro que querés borrar "${title}"?`
        : "¿Seguro que querés borrar este evento?";

      if (!confirm(msg)) return;

      const result = App.events?.removeEvent?.(eventId);
      if (!result?.ok) {
        alert("No se pudo borrar el evento.");
        return;
      }

      App.events.saveAndRefresh({ rebuildMarkers: true });
    });
  }

  function bindAdminUI() {
    const addBtn = document.getElementById("addEventBtn");
    const clearBtn = document.getElementById("clearEventsBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");

    if (addBtn) addBtn.addEventListener("click", () => App.map?.createEventFromAdminForm?.());
    if (clearBtn) clearBtn.addEventListener("click", () => App.map?.clearAllEvents?.());

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        state.editingEventId = null;

        const titleEl = document.getElementById("eventTitle");
        const dateEl = document.getElementById("eventDate");
        const latEl = document.getElementById("eventLat");
        const lngEl = document.getElementById("eventLng");
        const placeEl = document.getElementById("eventPlace");
        const startEl = document.getElementById("eventStart");
        const catEl = document.getElementById("eventCategory");
        const addBtn2 = document.getElementById("addEventBtn");

        if (titleEl) titleEl.value = "";
        if (dateEl) dateEl.value = "";
        if (latEl) latEl.value = "";
        if (lngEl) lngEl.value = "";
        if (placeEl) placeEl.value = "";
        if (startEl) startEl.value = "";
        if (catEl) catEl.value = "music";
        if (addBtn2) addBtn2.textContent = "Agregar evento";

        cancelBtn.hidden = true;
        App.map?.clearEventCreationMarker?.();
      });
    }
  }

  function bindCategoryUI() {
    const row = document.getElementById("categoryChips");
    if (!row) return;

    const chips = [...row.querySelectorAll(".chip")];

    function paintActive() {
      chips.forEach((btn) => {
        const on = btn.dataset.cat === (state.activeCategory || "all");
        btn.classList.toggle("isActive", on);
      });
    }

    paintActive();

    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.dataset.cat || "all";
        paintActive();
        renderAll({ rebuildMarkers: true, recomputeNearby: true });
      });
    });
  }

  /* =========================
     DEEP LINK (#e=EVENT_ID)
  ========================= */
  function queueDeepLinkFromHash() {
    const h = (location.hash || "").replace(/^#/, "");
    if (!h) return;

    const params = new URLSearchParams(h);
    const eventId = (params.get("e") || "").trim();
    if (!eventId) return;

    state._pendingDeepLinkEventId = decodeURIComponent(eventId);
  }

  function processQueuedDeepLink() {
    const eventId = state._pendingDeepLinkEventId;
    if (!eventId) return;

    const ev = App.events?.findEventById?.(eventId) || null;
    if (!ev) {
      state._pendingDeepLinkEventId = null;
      return;
    }

    document.title = ev?.title ? `${ev.title} · Agenda de eventos` : "Agenda de eventos";

    let categoryReset = false;

    if (
      state.activeCategory &&
      state.activeCategory !== "all" &&
      state.activeCategory !== ev.category
    ) {
      state.activeCategory = "all";
      categoryReset = true;

      const row = document.getElementById("categoryChips");
      if (row) {
        const chips = [...row.querySelectorAll(".chip")];
        chips.forEach((btn) => btn.classList.toggle("isActive", btn.dataset.cat === "all"));
      }
    }

    if (categoryReset) {
      renderAll({ rebuildMarkers: true, recomputeNearby: true });
    }

    const dateStr = (ev.date || "").slice(0, 10);
    const today = util.todayStrYYYYMMDD();

    if (dateStr === today) {
      renderEventsIntoUl("todayEvents", [ev], "No hay eventos hoy");
    } else if (dateStr > today) {
      renderEventsIntoUl("eventList", [ev], "No hay próximos eventos");
    } else {
      renderEventsIntoUl("eventList", [], "Ese evento ya pasó");
    }

    if (state._bootReady && App.map?.focusEventById) {
      const ok = App.map.focusEventById(eventId);
      if (!ok) setTimeout(() => App.map?.focusEventById?.(eventId), 250);
    }

    state._pendingDeepLinkEventId = null;
  }

  /* =========================
     BOOT
  ========================= */
  function bootAfterMapReady() {
    storage.loadEvents();
    storage.loadLoginState();
    if (storage.purgePastEvents()) storage.saveEvents();

    state.calendarCursor = new Date();

    bindLoginUI();
    bindPublicUI();
    bindAdminUI();
    bindCalendarUI();
    bindCategoryUI();
    bindDeleteEventUI();
    bindSidebarUI();

    App.map?.bindAdminCategoryChips?.();

    App.map.initMap(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map.setUserLocation(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map.recomputeNearbyEvents(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);

    renderAll({ rebuildMarkers: true, recomputeNearby: false });

    state._bootReady = true;
    processQueuedDeepLink();

    setInterval(() => {
      if (state.nearbyCenter && App.map?.recomputeNearbyEvents) {
        App.map.recomputeNearbyEvents(state.nearbyCenter.lat, state.nearbyCenter.lng);
        renderAll({ rebuildMarkers: false, recomputeNearby: false });
      } else {
        renderAll({ rebuildMarkers: false, recomputeNearby: false });
      }
    }, App.CFG.REFRESH_MS);
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

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".shareBtn");
    if (!btn) return;

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
  });

  /* =========================
     EXPORT UI MODULE
  ========================= */
    
    App.ui = {
    renderAll,
    commit,
    renderAppShell,
    renderList,
    renderEvents,
    renderNearbyEvents,
    renderTodayEvents,
    renderEventsIntoUl,
    renderCalendar,
    updateNearbyCount,
    bootAfterMapReady
  };

  App.renderAll = App.renderAll || renderAll;
  App.commit = App.commit || commit;
})();