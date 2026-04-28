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

  const categoryFiltered = util.filterByActiveCategory(state.logic.events || []);
  const visible = App.selectors?.applyBaficiFilter
    ? App.selectors.applyBaficiFilter(categoryFiltered)
    : categoryFiltered;

  for (const ev of visible) {
    const bucketDate = util.getEventDisplayDate
  ? util.getEventDisplayDate(ev)
  : ev?.date;

    if (!bucketDate) continue;
    if (!mapObj[bucketDate]) mapObj[bucketDate] = [];
    mapObj[bucketDate].push(ev);
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

      const evs = App.selectors?.sortPartnerEventsFirst
      ? App.selectors.sortPartnerEventsFirst(byDate[dateStr] || [])
      : (byDate[dateStr] || []);
      
  const hasFavorite = evs.some((ev) => App.events?.isFavorite?.(ev.id));
if (hasFavorite) {
  cell.classList.add("day--hasFavorite");
}

const hasPartner = evs.some((ev) => App.selectors?.isPartnerEvent?.(ev));

const isMobile = window.innerWidth <= 768;

if (isMobile) {
  if (evs.length > 0) {
    const more = document.createElement("div");
    more.className = `event event-more event-more--mobile${hasPartner ? " event-more--partner" : ""}`;
    more.textContent = hasPartner ? `⭐ +${evs.length}` : `+${evs.length}`;
    more.title = evs.length === 1
      ? "1 evento"
      : `${evs.length} eventos`;

    more.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      App.ui?.showCalendarDayPopover?.(more, dateStr, evs);
    });

    cell.appendChild(more);
  }
} else {
  const maxVisible = 3;

  evs.slice(0, maxVisible).forEach((ev) => {
    const b = document.createElement("div");
    const isFav = !!App.events?.isFavorite?.(ev.id);

    const partner = App.selectors?.getEventPartner?.(ev);

    b.className = `event${isFav ? " event--favorite" : ""}${partner ? " event--partner" : ""}`;

    const icon = util.categoryEmoji(ev.category) || "📍";
    const favMark = isFav ? "❤️ " : "";
    const partnerMark = partner ? `${partner.icon || "⭐"} ` : "";

    b.textContent = `${partnerMark}${favMark}${icon}${ev.title}`;
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