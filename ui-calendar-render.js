// ui-calendar-render.js
(() => {
  "use strict";

  const App = window.App;
  const { state, util } = App;

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

  function renderCalendar() {
    const cal = document.getElementById("calendar");
    const label = document.getElementById("monthLabel");
    if (!cal) return;

    App.ui?.removeCalendarPopover?.();
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
      cell.dataset.date = dateStr;

      const dn = document.createElement("div");
      dn.className = "day-number";
      dn.textContent = dayNum;
      cell.appendChild(dn);

      const evs = byDate[dateStr] || [];
      
      const hasFavorite = evs.some((ev) => App.events?.isFavorite?.(ev.id));
      if (hasFavorite) {
      cell.classList.add("day--hasFavorite");
    }

      const isMobile = window.innerWidth <= 768;
      const maxVisible = isMobile ? 2 : 3;

      evs.slice(0, maxVisible).forEach((ev) => {
  const b = document.createElement("div");
  const isFav = !!App.events?.isFavorite?.(ev.id);

  b.className = `event${isFav ? " event--favorite" : ""}`;

  const icon = util.categoryEmoji(ev.category) || "📍";
  const favMark = isFav ? "❤️ " : "";

  b.textContent = `${favMark}${icon}${ev.title}`;
  b.dataset.eid = ev.id || "";

        b.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          App.ui?.showCalendarEventPopover?.(b, ev);
        });

        cell.appendChild(b);
      });

      if (evs.length > maxVisible) {
        const more = document.createElement("div");
        more.className = "event event-more";
        const hiddenCount = evs.length - maxVisible;
        more.textContent = `+${hiddenCount}`;
        more.title = hiddenCount === 1
          ? "1 evento más"
          : `${hiddenCount} eventos más`;
        more.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          App.ui?.showCalendarDayPopover?.(more, dateStr, evs);
        });

        cell.appendChild(more);
      }

      cell.addEventListener("click", () => {
        App.ui?.openCalendarDay?.(dateStr);
      });

      cal.appendChild(cell);
    }
  }

  App.ui = {
    ...(App.ui || {}),
    renderCalendar
  };
})();