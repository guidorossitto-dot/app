// ui-calendar.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state, storage } = App;

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
    const groups = new Map();

    for (const ev of list || []) {
      if (!ev) continue;
      const key = util.locationKey(ev.lat, ev.lng);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          placeName: (ev.placeName || "").trim(),
          lat: ev.lat,
          lng: ev.lng,
          events: []
        });
      }

      groups.get(key).events.push(ev);
    }

    return [...groups.values()];
  }

  function renderGroupedList(ul, list) {
    if (!ul) return;
    ul.innerHTML = "";

    if (!list || list.length === 0) {
      ul.innerHTML = "<li>No hay eventos</li>";
      return;
    }

    function safeMinutesToStart(ev) {
      const m = util.minutesToStart(ev);
      return Number.isFinite(m) ? m : null;
    }

    function bestPlaceBadge(events) {
      const cands = (events || [])
        .map((ev) => ({ ev, min: safeMinutesToStart(ev) }))
        .filter((x) => x.min !== null);

      if (cands.length === 0) return "";

      const soon = cands
        .filter((x) => x.min > 0 && x.min <= 60)
        .sort((a, b) => a.min - b.min)[0];
      if (soon) return `🔥 Empieza en ${soon.min} min`;

      const inProg = cands
        .filter((x) => x.min <= 0 && x.min > -180)
        .sort((a, b) => Math.abs(a.min) - Math.abs(b.min))[0];
      if (inProg) return "🔴 En curso";

      return "";
    }

    const groups = groupByPlace(list);

    groups.sort((ga, gb) => {
      const aBadge = bestPlaceBadge(ga.events);
      const bBadge = bestPlaceBadge(gb.events);

      if (!!aBadge !== !!bBadge) return aBadge ? -1 : 1;

      const aMin = Math.min(
        ...ga.events.map((e) => {
          const m = safeMinutesToStart(e);
          return m === null ? 999999 : m > 0 ? m : 100000 + Math.abs(m);
        })
      );

      const bMin = Math.min(
        ...gb.events.map((e) => {
          const m = safeMinutesToStart(e);
          return m === null ? 999999 : m > 0 ? m : 100000 + Math.abs(m);
        })
      );

      return aMin - bMin;
    });

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

          <div style="margin-top:4px;display:flex;gap:10px;font-size:.85em">
            <button class="linkBtn"
              data-lat="${ev.lat}"
              data-lng="${ev.lng}"
              data-key="${util.locationKey(ev.lat, ev.lng)}">
              Ver en mapa
            </button>

            <button class="linkBtn shareBtn"
              data-eid="${encodeURIComponent(ev.id)}"
              data-title="${encodeURIComponent(ev.title || "")}">
              Compartir
            </button>
          </div>
        </div>
      `;
    };

    for (const g of groups) {
      const placeTitle = util.shortPlaceName(g.placeName) || "Lugar sin nombre";
      const count = g.events.length;
      const evs = [...g.events].sort(util.sortEventsByStatusThenTime);
      const badge = bestPlaceBadge(evs);

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
            <div style="margin-top:6px">${renderEv(evs[0])}</div>
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
              <button class="linkBtn"
                data-lat="${ev.lat}"
                data-lng="${ev.lng}"
                data-key="${util.locationKey(ev.lat, ev.lng)}">
                Ver en mapa
              </button>
            </div>
          </div>
        </div>
      `;
      ul.appendChild(li);
    });
  }

  function updateNearbyCount(list = state.nearbyEvents) {
    const el = document.getElementById("nearbyCount");
    if (!el) return;

    if (!list || list.length === 0) {
      el.textContent = "No hay eventos cerca tuyo hoy";
      return;
    }

    const today = util.todayStrYYYYMMDD();
    const todayList = (list || []).filter((ev) => (ev?.date || "").slice(0, 10) === today);

    if (todayList.length === 0) {
      el.textContent = "No hay eventos cerca tuyo hoy";
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

    function bestLabelForGroup(events) {
      const cands = (events || [])
        .map((ev) => ({ ev, min: safeMinutesToStart(ev) }))
        .filter((x) => x.min !== null);

      if (cands.length === 0) return "";

      const soon = cands
        .filter((x) => x.min > 0 && x.min <= 60)
        .sort((a, b) => a.min - b.min)[0];
      if (soon) return `🔥 Empieza en ${soon.min} min`;

      const inProg = cands
        .filter((x) => x.min <= 0 && x.min > -180)
        .sort((a, b) => Math.abs(a.min) - Math.abs(b.min))[0];
      if (inProg) return "🔴 En curso";

      return "";
    }

    const featured = [...todayList].sort((a, b) => featuredRank(a) - featuredRank(b))[0];
    const featuredStatus = featured ? util.getEventStatus(featured) : "";
    const featuredPlace = featured ? util.shortPlaceName(featured.placeName) || "Lugar sin nombre" : "";
    const featuredKey = featured ? util.locationKey(featured.lat, featured.lng) : "";

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
            ${featured.title}${categoryTagHTML(featured)}
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

    const groups = new Map();
    for (const ev of todayList) {
      const key = util.locationKey(ev.lat, ev.lng);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          placeName: (ev.placeName || "").trim(),
          lat: ev.lat,
          lng: ev.lng,
          events: []
        });
      }
      groups.get(key).events.push(ev);
    }

    const groupArr = [...groups.values()]
      .map((g) => {
        const sortKey = Math.min(
          ...g.events.map((e) => {
            const m = safeMinutesToStart(e);
            return m === null ? 999999 : m > 0 ? m : 100000 + Math.abs(m);
          })
        );
        return { ...g, label: bestLabelForGroup(g.events), sortKey };
      })
      .sort((a, b) => a.sortKey - b.sortKey);

    const renderEventLine = (ev) => {
      const time = util.formatTimeStart(ev);
      const status = util.getEventStatus(ev);
      return `
        <div class="nearbyEventLine">
          <div class="nearbyEventTitle">
            ${time ? `<span style="opacity:.75;margin-right:6px">${time}</span>` : ""}
            ${ev.title}${categoryTagHTML(ev)}
            ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
          </div>
          <div class="nearbySmall">${util.formatDateDisplay(ev.date)}</div>
        </div>
      `;
    };

    let inner = "";
    for (const g of groupArr) {
      const placeTitle = util.shortPlaceName(g.placeName) || "Lugar sin nombre";
      const count = g.events.length;
      const label = g.label;
      const evs = [...g.events].sort(util.sortEventsByStatusThenTime);

      if (count === 1) {
        inner += `
          <div style="padding:8px 0;border-top:1px solid #eee">
            <div class="nearbyPlaceLine">
              <div>
                <div class="nearbyPlaceTitle">${placeTitle}</div>
                ${label ? `<div class="nearbyMeta">${label}</div>` : ""}
              </div>
              <button class="linkBtn"
                data-lat="${g.lat}"
                data-lng="${g.lng}"
                data-key="${g.key}">
                Ver en mapa
              </button>
            </div>
            ${renderEventLine(evs[0])}
          </div>
        `;
        continue;
      }

      inner += `
        <details class="accordion" style="margin:8px 0">
          <summary class="nearbyPlaceLine">
            <span>
              <span class="nearbyPlaceTitle">${placeTitle}</span>
              <span style="opacity:.65"> · ${count} eventos</span>
              ${label ? `<span class="nearbyMeta" style="display:inline-block;margin-left:8px">${label}</span>` : ""}
            </span>
            <button class="linkBtn"
              data-lat="${g.lat}"
              data-lng="${g.lng}"
              data-key="${g.key}">
              Ver en mapa
            </button>
          </summary>
          <div style="padding:6px 8px">
            ${evs.map(renderEventLine).join("")}
          </div>
        </details>
      `;
    }

    el.innerHTML = `
      ${featuredHTML}
      <details class="nearbyMaster">
        <summary>
          <span class="nearbySummaryLeft">
            <span>${header}</span>
            ${catChip}
          </span>
        </summary>
        <div class="nearbyMasterBody">
          ${inner}
        </div>
      </details>
    `;
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

  function renderCalendar() {
    const cal = document.getElementById("calendar");
    const label = document.getElementById("monthLabel");
    if (!cal) return;

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
      evs.slice(0, 3).forEach((e) => {
        const b = document.createElement("div");
        b.className = "event";
        b.textContent = e.title;
        cell.appendChild(b);
      });

      if (evs.length > 3) {
        const more = document.createElement("div");
        more.className = "event";
        more.textContent = `+${evs.length - 3} más`;
        cell.appendChild(more);
      }

      cell.addEventListener("click", () => {
        const dayEvents = util.getEventsOnDate(dateStr, state.events);
        const today = util.todayStrYYYYMMDD();

        if (dateStr === today) {
          renderEventsIntoUl("todayEvents", dayEvents, "No hay eventos hoy");
        } else if (dateStr > today) {
          renderEventsIntoUl("eventList", dayEvents, "No hay eventos ese día");
        } else {
          renderEventsIntoUl("eventList", [], "Ese día ya pasó");
        }

        if (dayEvents.length > 0 && state.map) {
          state.map.setView([dayEvents[0].lat, dayEvents[0].lng], 14);
        }
      });

      cal.appendChild(cell);
    }
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
        renderAll({ rebuildMarkers: true, recomputeNearby: true });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        state.isLoggedIn = false;
        storage.saveLoginState();
        App.map.clearEventCreationMarker();
        renderAll({ rebuildMarkers: true, recomputeNearby: true });
      });
    }
  }

  function bindPublicUI() {
    const autoBtn = document.getElementById("autoLocationBtn");
    const searchBtn = document.getElementById("searchNearbyBtn");

    if (autoBtn) autoBtn.addEventListener("click", () => App.map?.useMyLocation?.());
    if (searchBtn) searchBtn.addEventListener("click", () => App.map?.searchNearbyFromInputs?.());
  }

  function bindAdminUI() {
    const addBtn = document.getElementById("addEventBtn");
    const clearBtn = document.getElementById("clearEventsBtn");

    if (addBtn) addBtn.addEventListener("click", () => App.map?.createEventFromAdminForm?.());
    if (clearBtn) clearBtn.addEventListener("click", () => App.map?.clearAllEvents?.());
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

    const all = state.events || [];
    const ev = all.find((e) => String(e.id) === String(eventId));
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
        chips.forEach((btn) =>
          btn.classList.toggle("isActive", btn.dataset.cat === "all")
        );
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
})();