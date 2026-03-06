// app.js (ordenado + calendario + popups estables + commit/renderAll)
// Compatible con tu HTML actual (addEventBtn, clearEventsBtn, autoLocationBtn, searchNearbyBtn)

(() => {
  "use strict";

  /* =========================
     CONFIG + STATE
  ========================= */
  const CFG = {
    SEARCH_RADIUS_KM: 2,
    PIN_PRECISION: 4,
    DEFAULT_LAT: -34.6037,
    DEFAULT_LNG: -58.3816,
    REFRESH_MS: 60000
  };

  const state = {
    isLoggedIn: false,
    events: [],

    map: null,
    userMarker: null,
    eventCreationMarker: null,

    locationMarkers: {}, // { key: { marker, events, lat, lng } }
    eventMarkers: [],

    calendarCursor: new Date()
  };

  /* =========================
     UTIL
  ========================= */
  function newId() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return `${Date.now()}_${Math.random()}`;
  }

  function isValidCoord(n) {
    return typeof n === "number" && !Number.isNaN(n) && Number.isFinite(n);
  }

  function shortPlaceName(full) {
    const s = (full || "").toString().trim();
    if (!s) return "";
    return s.split(",")[0].trim();
  }

  function locationKey(lat, lng) {
    return `${Number(lat).toFixed(CFG.PIN_PRECISION)},${Number(lng).toFixed(CFG.PIN_PRECISION)}`;
  }

  /* =========================
     FECHAS / TIEMPOS
  ========================= */
  function todayStrYYYYMMDD() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  function addDaysYYYYMMDD(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, (m - 1), d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function makeLocalDateTime(dateStr, timeStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
    return new Date(y, (m - 1), d, hh || 0, mm || 0, 0, 0);
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }

  function formatTimeStart(ev) {
    const s = (ev?.startTime || "").toString().trim();
    return s ? s : "";
  }

  function minutesToStart(ev) {
    if (!ev?.date) return null;

    const st = (ev.startTime || "").toString().trim();
    if (!st) return null;

    const [y, mo, d] = ev.date.split("-").map(Number);
    const [hh, mm] = st.split(":").map(Number);

    const eventDate = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
    const diff = eventDate.getTime() - Date.now();
    return Math.round(diff / 60000);
  }

  function getEventStatus(ev) {
    if (!ev || !ev.date) return "";

    const today = todayStrYYYYMMDD();
    const tomorrow = addDaysYYYYMMDD(today, 1);

    // Si es mañana, mostrar "Mañana HH:MM" o "Mañana"
    if (ev.date === tomorrow) {
      const st = (ev.startTime || "").trim();
      return st ? `Mañana ${st}` : "Mañana";
    }

    // Si es futuro (más allá de mañana): "En N días"
    if (ev.date > today) {
      const diffDays = Math.round(
        (makeLocalDateTime(ev.date, "00:00") - makeLocalDateTime(today, "00:00")) / 86400000
      );
      return `En ${diffDays} días`;
    }

    // Hoy
    const st = (ev.startTime || "").trim();
    if (!st) return "Hoy";

    const now = new Date();
    const eventDT = makeLocalDateTime(ev.date, st);
    const diffMs = eventDT - now;

    if (diffMs <= 0) return "En curso";

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `Comienza en ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 6) return `Comienza en ${hours} h`;

    return "Hoy";
  }

  function sortByStartRealtime(a, b) {
    const ma = minutesToStart(a);
    const mb = minutesToStart(b);

    const aNull = (ma === null || !Number.isFinite(ma));
    const bNull = (mb === null || !Number.isFinite(mb));
    if (aNull !== bNull) return aNull ? 1 : -1;

    if (aNull && bNull) return (a.title || "").localeCompare(b.title || "");

    const aUpcoming = ma > 0;
    const bUpcoming = mb > 0;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

    if (aUpcoming && bUpcoming) return ma - mb;

    return Math.abs(ma) - Math.abs(mb);
  }

  function sortEventsByStatusThenTime(a, b) {
    const sa = getEventStatus(a);
    const sb = getEventStatus(b);

    const rank = (s) => {
      if (!s) return 3;
      if (s.startsWith("En curso")) return 0;
      if (s.startsWith("Comienza en")) return 1;
      if (s === "Hoy") return 2;
      return 3;
    };

    const ra = rank(sa);
    const rb = rank(sb);
    if (ra !== rb) return ra - rb;

    const ta = (a.startTime || "99:99");
    const tb = (b.startTime || "99:99");
    const c = ta.localeCompare(tb);
    if (c !== 0) return c;

    return (a.title || "").localeCompare(b.title || "");
  }

  /* =========================
     DISTANCIA (Haversine)
  ========================= */
  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* =========================
     STORAGE
  ========================= */
  function saveEvents() {
    localStorage.setItem("events", JSON.stringify(state.events));
  }

  function sanitizeLoadedEvents(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
      .map(ev => {
        const lat = Number(ev.lat);
        const lng = Number(ev.lng);
        const id = (ev.id ?? "").toString().trim() || newId();

        return {
          id,
          title: (ev.title ?? "").toString(),
          date: (ev.date ?? "").toString(),
          lat,
          lng,
          placeName: (ev.placeName ?? "").toString(),
          startTime: (ev.startTime ?? "").toString()
        };
      })
      .filter(ev => ev.title && ev.date && isValidCoord(ev.lat) && isValidCoord(ev.lng));
  }

  function loadEvents() {
    const stored = localStorage.getItem("events");
    const parsed = stored ? JSON.parse(stored) : [];
    state.events = sanitizeLoadedEvents(parsed);
  }

  function saveLoginState() {
    localStorage.setItem("isLoggedIn", JSON.stringify(state.isLoggedIn));
  }

  function loadLoginState() {
    const stored = localStorage.getItem("isLoggedIn");
    state.isLoggedIn = stored ? JSON.parse(stored) : false;
  }

  function purgePastEvents() {
    const today = todayStrYYYYMMDD();
    const before = state.events.length;
    state.events = state.events.filter(ev => ev?.date && ev.date >= today);
    return state.events.length !== before;
  }

  /* =========================
     GROUP BY PLACE + RENDER (acordeón interno)
  ========================= */
  function groupByPlace(list) {
    const groups = new Map(); // key -> { key, placeName, lat, lng, events: [] }

    for (const ev of (list || [])) {
      if (!ev) continue;

      const key = locationKey(ev.lat, ev.lng);
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
      const m = minutesToStart(ev);
      return Number.isFinite(m) ? m : null;
    }

    function bestPlaceBadge(events) {
      const cands = (events || [])
        .map(ev => ({ ev, min: safeMinutesToStart(ev) }))
        .filter(x => x.min !== null);

      if (cands.length === 0) return "";

      const soon = cands
        .filter(x => x.min > 0 && x.min <= 60)
        .sort((a, b) => a.min - b.min)[0];
      if (soon) return `🔥 Empieza en ${soon.min} min`;

      const inProg = cands
        .filter(x => x.min <= 0 && x.min > -180)
        .sort((a, b) => Math.abs(a.min) - Math.abs(b.min))[0];
      if (inProg) return "🔴 En curso";

      return "";
    }

    const groups = groupByPlace(list);

    // orden de lugares: los que tienen “algo pasando” arriba
    groups.sort((ga, gb) => {
      const aBadge = bestPlaceBadge(ga.events);
      const bBadge = bestPlaceBadge(gb.events);

      if (!!aBadge !== !!bBadge) return aBadge ? -1 : 1;

      const aMin = Math.min(...ga.events.map(e => {
        const m = safeMinutesToStart(e);
        return (m === null) ? 999999 : (m > 0 ? m : 100000 + Math.abs(m));
      }));
      const bMin = Math.min(...gb.events.map(e => {
        const m = safeMinutesToStart(e);
        return (m === null) ? 999999 : (m > 0 ? m : 100000 + Math.abs(m));
      }));

      return aMin - bMin;
    });

    const renderEv = (ev) => {
      const time = formatTimeStart(ev);
      const status = getEventStatus(ev);
      return `
        <div style="padding:6px 0;border-top:1px solid #eee">
          <div style="font-weight:600">
            ${time ? `<span style="opacity:.75;margin-right:6px">${time}</span>` : ""}
            ${ev.title}
            ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
          </div>
          <div style="opacity:.75;font-size:.9em">${formatDateDisplay(ev.date)}</div>
        </div>
      `;
    };

    for (const g of groups) {
      const placeTitle = shortPlaceName(g.placeName) || "Lugar sin nombre";
      const count = g.events.length;

      const evs = [...g.events].sort(sortEventsByStatusThenTime);
      const badge = bestPlaceBadge(evs);

      const li = document.createElement("li");

      // ✅ 1 evento -> sin acordeón
      if (count === 1) {
        li.innerHTML = `
          <div style="padding:8px 0;border-top:1px solid #eee">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
              <div>
                <!-- sin negrita fuerte -->
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

      // ✅ 2+ -> acordeón
      li.innerHTML = `
        <details class="accordion" style="margin:6px 0">
          <summary style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span>
              <!-- sin negrita fuerte -->
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
     CORE: renderAll + commit
  ========================= */
  function renderAll(opts = {}) {
    const { rebuildMarkers = true, keepDistanceFilter = true } = opts;

    renderApp();
    renderTodayEvents();
    renderCalendar();

    if (rebuildMarkers) rebuildLocationMarkers();

    if (keepDistanceFilter) {
      const pos = state.userMarker ? state.userMarker.getLatLng() : null;
      if (pos) {
        filterEventsByDistance(pos.lat, pos.lng);
      } else {
        renderEvents(state.events);
        renderNearbyEvents([]);
      }
    } else {
      renderEvents(state.events);
      renderNearbyEvents([]);
    }
  }

  function commit(opts = {}) {
    const changed = purgePastEvents();
    // guardamos siempre (simple) o solo si cambió (más eficiente). Dejo “siempre” por estabilidad:
    saveEvents();
    renderAll(opts);
    return changed;
  }

  /* =========================
     UI LOGIN
  ========================= */
  function renderApp() {
    const adminView = document.getElementById("adminView");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (adminView) adminView.hidden = !state.isLoggedIn;
    if (loginBtn) loginBtn.hidden = state.isLoggedIn;
    if (logoutBtn) logoutBtn.hidden = !state.isLoggedIn;
  }

  function bindLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        state.isLoggedIn = true;
        saveLoginState();
        renderApp();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        state.isLoggedIn = false;
        saveLoginState();
        renderApp();
      });
    }
  }

  /* =========================
     RENDER LISTAS
  ========================= */
  function getTodayEvents(list = state.events) {
    const today = todayStrYYYYMMDD();
    return (list || []).filter(ev => ev?.date === today);
  }

  function renderEvents(list = state.events) {
    const ul = document.getElementById("eventList");
    if (!ul) return;

    const today = todayStrYYYYMMDD();
    const onlyFuture = (list || []).filter(ev => ev?.date && ev.date > today);

    if (!onlyFuture || onlyFuture.length === 0) {
      ul.innerHTML = "<li>No hay próximos eventos</li>";
      return;
    }

    renderGroupedList(ul, onlyFuture);
  }

  function renderEventsIntoUl(ulId, list, emptyMsg) {
    const ul = document.getElementById(ulId);
    if (!ul) return;
    ul.innerHTML = "";

    if (!list || list.length === 0) {
      ul.innerHTML = `<li>${emptyMsg || "No hay eventos"}</li>`;
      return;
    }

    const sorted = [...list].sort(sortEventsByStatusThenTime);

    sorted.forEach(ev => {
      const time = formatTimeStart(ev);
      const status = getEventStatus(ev);

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="eventItem">
          <div class="eventDate">${formatDateDisplay(ev.date)}</div>
          <div class="eventMain">
            <div class="eventTitle">
              ${time ? `<span style="opacity:.75;margin-right:6px">${time}</span>` : ""}
              ${ev.title}
              ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
            </div>
            <div class="eventPlace">
              ${ev.placeName ? `<div>${shortPlaceName(ev.placeName)}</div>` : ""}
              <button class="linkBtn"
                data-lat="${ev.lat}"
                data-lng="${ev.lng}"
                data-key="${locationKey(ev.lat, ev.lng)}">
                Ver en mapa
              </button>
            </div>
          </div>
        </div>
      `;
      ul.appendChild(li);
    });
  }

  function renderNearbyEvents(list) {
    const ul = document.getElementById("nearbyList");
    if (!ul) return;

    if (!list || list.length === 0) {
      ul.innerHTML = "<li>No hay eventos a 2 km</li>";
      return;
    }

    renderGroupedList(ul, list);
  }

  function updateNearbyCount(list) {
    const el = document.getElementById("nearbyCount");
    if (!el) return;

    if (!list || list.length === 0) {
      el.textContent = "No hay eventos cerca tuyo hoy";
      return;
    }

    const today = todayStrYYYYMMDD();
    const todayList = (list || []).filter(ev => (ev.date || "").slice(0, 10) === today);

    const n = todayList.length;
    const header = (n === 1) ? "1 evento cerca tuyo hoy" : `${n} eventos cerca tuyo hoy`;

    // agrupar por lugar
    const groups = new Map();
    for (const ev of todayList) {
      const key = locationKey(ev.lat, ev.lng);
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

    function safeMinutesToStart(ev) {
      const min = minutesToStart(ev);
      return Number.isFinite(min) ? min : null;
    }

    function labelForMin(min) {
      if (min === null) return "";
      if (min <= 0 && min > -180) return "🔴 En curso";
      if (min > 0 && min <= 60) return `🔥 Empieza en ${min} min`;
      return "";
    }

    const placeCards = [];
    for (const g of groups.values()) {
      const candidates = g.events
        .map(ev => {
          const min = safeMinutesToStart(ev);
          return { ev, min, label: labelForMin(min) };
        })
        .filter(x => x.label);

      if (candidates.length === 0) continue;

      const soon = candidates
        .filter(x => x.min !== null && x.min > 0 && x.min <= 60)
        .sort((a, b) => a.min - b.min)[0];

      const inProgress = candidates
        .filter(x => x.min !== null && x.min <= 0 && x.min > -180)
        .sort((a, b) => Math.abs(a.min) - Math.abs(b.min))[0];

      const best = soon || inProgress;
      if (!best) continue;

      const placeTitle = shortPlaceName(g.placeName) || "Lugar sin nombre";

      placeCards.push({
        sortKey: (best.min > 0 ? best.min : 100000 + Math.abs(best.min)),
        html: `
          <div style="padding:6px 0;border-top:1px solid #eee">
            <div style="font-weight:600">${placeTitle}</div>
            <div style="opacity:.85">${best.ev.title}</div>
            <div style="opacity:.7;font-size:.9em">${best.label}</div>
          </div>
        `
      });
    }

    placeCards.sort((a, b) => a.sortKey - b.sortKey);

    let html = `<div style="font-weight:600;margin-bottom:4px">${header}</div>`;

    if (placeCards.length === 0) {
      const next = [...todayList].sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"))[0];
      html += `
        <div style="opacity:.75">
          Próximo: <strong>${next.title}</strong>${next.startTime ? " · " + next.startTime : ""}
        </div>
      `;
    } else {
      html += `<div style="opacity:.75;margin-bottom:2px">Estado por lugar:</div>`;
      html += placeCards.map(x => x.html).join("");
    }

    el.innerHTML = html;
  }

  function renderTodayEvents() {
    const ul = document.getElementById("todayEvents");
    if (!ul) return;

    const todayStr = todayStrYYYYMMDD();
    const todayEvents = state.events.filter(ev => ev.date === todayStr);

    if (!todayEvents || todayEvents.length === 0) {
      ul.innerHTML = "<li>No hay eventos hoy</li>";
      return;
    }

    renderGroupedList(ul, todayEvents);
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
    for (const ev of state.events) {
      if (!ev.date) continue;
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

    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    if (label) label.textContent = `${monthNames[month]} ${year}`;

    const first = new Date(year, month, 1);
    const startDow = first.getDay(); // 0=Dom
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
      evs.slice(0, 3).forEach(e => {
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
        const dayEvents = (state.events || []).filter(ev => (ev.date || "").slice(0,10) === dateStr);
        const today = todayStrYYYYMMDD();

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
        state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
        renderCalendar();
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
        renderCalendar();
      });
    }
  }

  /* =========================
     INPUTS LAT/LNG USUARIO
  ========================= */
  function setUserInputs(lat, lng) {
    const uLat = document.getElementById("userLat");
    const uLng = document.getElementById("userLng");
    if (uLat) uLat.value = Number(lat).toFixed(6);
    if (uLng) uLng.value = Number(lng).toFixed(6);
  }

  /* =========================
     MARKERS
  ========================= */
  function clearEventMarkers() {
    state.eventMarkers.forEach(m => m.remove());
    state.eventMarkers = [];
  }

  function highlightNearbyMarkers(filteredEvents) {
    const nearbyKeys = new Set(filteredEvents.map(ev => locationKey(ev.lat, ev.lng)));

    Object.entries(state.locationMarkers).forEach(([key, loc]) => {
      const isNear = nearbyKeys.has(key);
      loc.marker.setOpacity(isNear ? 1 : 0.35);

      const el = loc.marker.getElement && loc.marker.getElement();
      if (el) el.style.pointerEvents = "auto";
    });
  }

  function rebuildLocationMarkers(list = state.events) {
    if (!state.map) return;

    clearEventMarkers();
    state.locationMarkers = {};

    const today = todayStrYYYYMMDD();

    for (const ev of list) {
      if ((ev.date || "").slice(0, 10) !== today) continue; // SOLO HOY
      if (!isValidCoord(ev.lat) || !isValidCoord(ev.lng)) continue;

      const key = locationKey(ev.lat, ev.lng);

      if (!state.locationMarkers[key]) {
        const marker = L.marker([ev.lat, ev.lng], { bubblingMouseEvents: false }).addTo(state.map);

        state.locationMarkers[key] = { marker, events: [], lat: ev.lat, lng: ev.lng };
        state.eventMarkers.push(marker);

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
          filterEventsByDistance(lat, lng);
          state.map.setView([lat, lng], 15);

          marker.openPopup();

          if (state.isLoggedIn) prepareEventCreation(lat, lng);
        });
      }

      state.locationMarkers[key].events.push(ev);
    }

    Object.values(state.locationMarkers).forEach(loc => {
      const placeName = shortPlaceName(
        (loc.events.find(e => (e.placeName || "").trim())?.placeName || "").trim()
      );

      const actionBtn = state.isLoggedIn
        ? `<button class="popupAddBtn"
              data-lat="${loc.lat}"
              data-lng="${loc.lng}"
              data-place="${encodeURIComponent(placeName || "")}">
            Cargar evento acá
          </button>`
        : "";

      let html = `
        <div style="margin-bottom:6px">
          <div style="font-weight:800;font-size:1.05em">
            ${placeName ? placeName : "Eventos en este punto"}
          </div>
          <div style="opacity:.65;font-size:.9em">Eventos en este lugar:</div>
          ${actionBtn}
        </div>
        <div style="margin-top:6px">
      `;

      const sorted = [...loc.events].sort(sortEventsByStatusThenTime);

      sorted.forEach(e => {
        const st = formatTimeStart(e);
        const status = getEventStatus(e);

        html += `
          <div style="padding:6px 0;border-top:1px solid #eee">
            <div style="font-weight:600">
              ${e.title}
              ${status ? `<span style="opacity:.6;font-size:.85em;margin-left:6px">${status}</span>` : ""}
            </div>
            <div style="opacity:.75;font-size:.9em">
              ${formatDateDisplay(e.date)}${st ? " · " + st : ""}
            </div>
          </div>
        `;
      });

      html += `</div>`;

      loc.marker.bindPopup(html, {
        closeButton: true,
        autoPan: true,
        keepInView: true,
        autoPanPadding: [30, 30],
        offset: [0, -10]
      });

      loc.marker.on("popupopen", (evt) => {
        const el = evt.popup.getElement();
        if (!el) return;

        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);

        const btn = el.querySelector(".popupAddBtn");
        if (btn) {
          btn.addEventListener("click", () => {
            const lat = Number(btn.dataset.lat);
            const lng = Number(btn.dataset.lng);
            const place = decodeURIComponent(btn.dataset.place || "");

            setUserLocation(lat, lng);
            filterEventsByDistance(lat, lng);
            state.map.setView([lat, lng], 15);

            prepareEventCreation(lat, lng);

            const placeEl = document.getElementById("eventPlace");
            if (placeEl && place && !placeEl.value.trim()) {
              placeEl.value = place;
            }

            const titleEl = document.getElementById("eventTitle");
            if (titleEl) titleEl.focus();
          }, { once: true });
        }
      });

      loc.marker.setOpacity(1);
    });
  }

  /* =========================
     FILTRO RADIO
  ========================= */
  function filterEventsByDistance(lat, lng) {
    const base = getTodayEvents(state.events);

    const filtered = base.filter(ev => {
      if (!isValidCoord(ev.lat) || !isValidCoord(ev.lng)) return false;
      return distanceKm(lat, lng, ev.lat, ev.lng) <= CFG.SEARCH_RADIUS_KM;
    });

    updateNearbyCount(filtered);

    renderEvents();
    renderNearbyEvents(filtered);
    highlightNearbyMarkers(filtered);

    return filtered;
  }

  /* =========================
     MAPA HELPERS
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
        filterEventsByDistance(pos.lat, pos.lng);
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

  /* =========================
     ADMIN: crear / borrar eventos
  ========================= */
  function createEventFromAdminForm() {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");

    if (!titleEl || !dateEl || !latEl || !lngEl) return;

    const title = titleEl.value.trim();
    const date = dateEl.value.trim();
    const lat = Number(latEl.value);
    const lng = Number(lngEl.value);
    const placeName = placeEl ? placeEl.value.trim() : "";
    const startTime = startEl ? startEl.value.trim() : "";

    if (!title || !date || !isValidCoord(lat) || !isValidCoord(lng)) {
      alert("Completá título, fecha y coordenadas válidas.");
      return;
    }

    state.events.push({ id: newId(), title, date, lat, lng, placeName, startTime });

    titleEl.value = "";
    if (startEl) startEl.value = "";

    commit({ rebuildMarkers: true, keepDistanceFilter: true });
  }

  function clearAllEvents() {
    if (!confirm("¿Seguro que querés borrar todos los eventos?")) return;
    state.events = [];
    commit({ rebuildMarkers: true, keepDistanceFilter: true });
  }

  /* =========================
     GEOLOCALIZACIÓN + BUSCAR
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
        state.map.setView([lat, lng], 15);

        filterEventsByDistance(lat, lng);

        if (state.isLoggedIn) prepareEventCreation(lat, lng);
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

    if (!isValidCoord(lat) || !isValidCoord(lng)) {
      alert("Ingresá latitud y longitud válidas.");
      return;
    }

    setUserLocation(lat, lng);
    state.map.setView([lat, lng], 15);
    filterEventsByDistance(lat, lng);
  }

  /* =========================
     VER EN MAPA: centrar + abrir popup del pin
  ========================= */
  document.addEventListener("click", (e) => {
    // 1) POPUP: "Cargar evento acá"
    const addBtn = e.target.closest(".popupAddBtn");
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();

      const lat = Number(addBtn.dataset.lat);
      const lng = Number(addBtn.dataset.lng);
      const place = decodeURIComponent(addBtn.dataset.place || "");

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.map) return;

      setUserLocation(lat, lng);
      filterEventsByDistance(lat, lng);
      state.map.setView([lat, lng], 15);

      if (state.isLoggedIn) prepareEventCreation(lat, lng);

      const adminView = document.getElementById("adminView");
      if (adminView && state.isLoggedIn) {
        adminView.hidden = false;
        adminView.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      const placeEl = document.getElementById("eventPlace");
      if (placeEl && place && !placeEl.value.trim()) placeEl.value = place;

      setTimeout(() => {
        const titleEl = document.getElementById("eventTitle");
        if (titleEl) titleEl.focus();
      }, 200);

      return;
    }

    // 2) LISTA: "Ver en mapa"
    const linkBtn = e.target.closest(".linkBtn");
    if (linkBtn) {
      e.preventDefault();
      e.stopPropagation();

      const lat = parseFloat(linkBtn.dataset.lat);
      const lng = parseFloat(linkBtn.dataset.lng);
      const key = linkBtn.dataset.key || locationKey(lat, lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.map) return;

      const mapEl = document.getElementById("map");
      if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

      state.map.setView([lat, lng], 15);

      rebuildLocationMarkers(getTodayEvents(state.events));

      setTimeout(() => {
        const loc = state.locationMarkers[key];
        if (loc && loc.marker) loc.marker.openPopup();
      }, 120);

      return;
    }
  });

  /* =========================
     MAPA INIT
  ========================= */
  function initMap(lat, lng) {
    state.map = L.map("map").setView([lat, lng], 15);
    state.map.doubleClickZoom.disable();

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(state.map);

    state.map.on("click", (e) => {
      const t = e.originalEvent?.target;
      if (t && (t.closest?.(".leaflet-marker-icon") || t.closest?.(".leaflet-popup"))) return;

      const clat = e.latlng.lat;
      const clng = e.latlng.lng;

      setUserLocation(clat, clng);
      filterEventsByDistance(clat, clng);
      state.map.setView([clat, clng], 15);

      if (state.isLoggedIn) prepareEventCreation(clat, clng);
    });
  }

  /* =========================
     PLACES (Nominatim)
  ========================= */
  async function searchPlacesNominatim(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

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

    results.forEach(r => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.textContent = r.display_name;

      li.onclick = () => {
        const lat = Number(r.lat);
        const lng = Number(r.lon);

        if (state.map && Number.isFinite(lat) && Number.isFinite(lng)) {
          state.map.setView([lat, lng], 16);
        }

        const latEl = document.getElementById("eventLat");
        const lngEl = document.getElementById("eventLng");
        if (latEl) latEl.value = lat.toFixed(6);
        if (lngEl) lngEl.value = lng.toFixed(6);

        const placeEl = document.getElementById("eventPlace");
        if (placeEl) placeEl.value = shortPlaceName(r.name || r.display_name);

        const titleEl = document.getElementById("eventTitle");
        if (titleEl && !titleEl.value.trim()) {
          titleEl.value = r.name || r.display_name.split(",")[0];
        }

        if (state.isLoggedIn) prepareEventCreation(lat, lng);
      };

      ul.appendChild(li);
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
     BIND UI (botones de tu HTML)
  ========================= */
  function bindPublicUI() {
    const autoBtn = document.getElementById("autoLocationBtn");
    const searchBtn = document.getElementById("searchNearbyBtn");

    if (autoBtn) autoBtn.addEventListener("click", useMyLocation);
    if (searchBtn) searchBtn.addEventListener("click", searchNearbyFromInputs);
  }

  function bindAdminUI() {
    const addBtn = document.getElementById("addEventBtn");
    const clearBtn = document.getElementById("clearEventsBtn");

    if (addBtn) addBtn.addEventListener("click", createEventFromAdminForm);
    if (clearBtn) clearBtn.addEventListener("click", clearAllEvents);
  }

  /* =========================
     INIT
  ========================= */
  loadEvents();
  loadLoginState();

  // Limpieza inicial si hay eventos viejos
  if (purgePastEvents()) saveEvents();

  state.calendarCursor = new Date();

  bindLoginUI();
  bindPublicUI();
  bindAdminUI();
  bindCalendarUI();
  bindPlaceSearchUI();

  initMap(CFG.DEFAULT_LAT, CFG.DEFAULT_LNG);

  setUserLocation(CFG.DEFAULT_LAT, CFG.DEFAULT_LNG);
  renderAll({ rebuildMarkers: true, keepDistanceFilter: true });

  // ✅ refresco único (cada 60s) para "Empieza en..." / "En curso" + listas/nearby
  setInterval(() => {
    const pos = state.userMarker?.getLatLng?.();
    if (pos) {
      // actualiza estados + nearby + opacidades
      filterEventsByDistance(pos.lat, pos.lng);
    } else {
      renderTodayEvents();
      renderEvents();
      renderNearbyEvents(getTodayEvents(state.events));
    }
  }, CFG.REFRESH_MS);

})();