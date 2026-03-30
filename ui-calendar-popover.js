// ui-calendar-popover.js
(() => {
  "use strict";

  const App = window.App;
  const { state, util } = App;

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
    const icon = util.categoryEmoji(ev.category) || "📍";

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

  <button
    type="button"
    class="linkBtn calendarPopoverShareBtn shareBtn"
    data-eid="${encodeURIComponent(ev.id || "")}"
    data-title="${encodeURIComponent(ev.title || "")}">
    Compartir
  </button>

  ${
    ev.link
      ? `<a
          class="linkBtn"
          href="${ev.link}"
          target="_blank"
          rel="noopener noreferrer">
          Ver info
        </a>`
      : ""
  }

  ${
    util.canManageUI() && ev?.id
      ? `
        <button type="button" class="linkBtn calendarPopoverEditBtn">Editar</button>

        <button
          type="button"
          class="linkBtn calendarPopoverDeleteBtn deleteEventBtn"
          data-delete-eid="${encodeURIComponent(ev.id || "")}"
          data-delete-title="${encodeURIComponent(ev.title || "")}">
          Borrar
        </button>
      `
      : ""
  }

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

        const today = util.todayStrYYYYMMDD();
        const isToday = String(ev.date || "").slice(0, 10) === today;

        if (isToday && App.map?.focusEventById && ev.id) {
          const ok = App.map.focusEventById(ev.id);
          if (ok) return;
        }

        const placeTitle = util.shortPlaceName(ev.placeName) || "Lugar sin nombre";
        const eventTitle = ev.title || "Evento";

        if (App.map?.focusPlaceByCoords && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
          App.map.focusPlaceByCoords(
            Number(ev.lat),
            Number(ev.lng),
            placeTitle,
            eventTitle,
            16
          );
          return;
        }

        if (state.runtime.map && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
          state.runtime.map.setView([ev.lat, ev.lng], 16);
        }
      });
    }
    const shareBtn = pop.querySelector(".calendarPopoverShareBtn");
if (shareBtn) {
  shareBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await App.actions?.shareEventFlow?.({ button: shareBtn });
  });
}

    const editBtn = pop.querySelector(".calendarPopoverEditBtn");
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        removeCalendarPopover();
        App.adminForm?.startEditingEventFromId?.(ev.id);
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
            const icon = util.categoryEmoji(ev.category) || "📍";

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

                ${
  (ev?.id || ev.link || (util.canManageUI() && ev?.id))
    ? `
      <div class="calendarEventPopover__actions" style="margin-top:8px;">

        ${
          ev?.id
            ? `
              <button
                type="button"
                class="linkBtn calendarDayPopoverShareBtn"
                data-share-eid="${encodeURIComponent(ev.id || "")}"
                data-share-title="${encodeURIComponent(ev.title || "")}">
                Compartir
              </button>
            `
            : ""
        }

        ${
          ev.link
            ? `<a
                class="linkBtn"
                href="${ev.link}"
                target="_blank"
                rel="noopener noreferrer">
                Ver info
              </a>`
            : ""
        }

        ${
          util.canManageUI() && ev?.id
            ? `
              <button
                type="button"
                class="linkBtn calendarDayPopoverEditBtn"
                data-edit-eid="${encodeURIComponent(ev.id || "")}">
                Editar
              </button>

              <button
                type="button"
                class="linkBtn calendarDayPopoverDeleteBtn deleteEventBtn"
                data-delete-eid="${encodeURIComponent(ev.id || "")}"
                data-delete-title="${encodeURIComponent(ev.title || "")}">
                Borrar
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
    const actionBtn = e.target.closest("button, a");
    if (actionBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const eventId = decodeURIComponent(item.dataset.eid || "");
    if (!eventId) return;

    const ev = App.events?.findEventById?.(eventId) || null;
    if (!ev) return;

    removeCalendarPopover();

    const today = util.todayStrYYYYMMDD();
    const isToday = String(ev.date || "").slice(0, 10) === today;

    if (isToday && App.map?.focusEventById) {
      const ok = App.map.focusEventById(eventId);
      if (ok) return;
    }

    const placeTitle = util.shortPlaceName(ev.placeName) || "Lugar sin nombre";
    const eventTitle = ev.title || "Evento";

    if (App.map?.focusPlaceByCoords && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
      App.map.focusPlaceByCoords(
        Number(ev.lat),
        Number(ev.lng),
        placeTitle,
        eventTitle,
        16
      );
      return;
    }

    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

    if (state.runtime.map && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
      state.runtime.map.setView([ev.lat, ev.lng], 16);
    }
  });
});

    pop.querySelectorAll(".calendarDayPopoverEditBtn[data-edit-eid]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const eventId = decodeURIComponent(btn.dataset.editEid || "");
        if (!eventId) return;

        removeCalendarPopover();
        App.adminForm?.startEditingEventFromId?.(eventId);
      });
    });

    pop.querySelectorAll(".calendarDayPopoverShareBtn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    btn.dataset.eid = btn.dataset.shareEid || "";
    btn.dataset.title = btn.dataset.shareTitle || "";

    await App.actions?.shareEventFlow?.({ button: btn });
  });
});

    pop.querySelectorAll(".calendarDayPopoverDeleteBtn[data-delete-eid]").forEach((btn) => {
  btn.addEventListener("click", () => {
    removeCalendarPopover();
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
    App.ui?.setListFocus?.({ type: "day", dateStr });
    App.renderAll?.({
      rebuildMarkers: false,
      recomputeNearby: false
    });
  }

  function openCalendarDayByDate(dateStr) {
  const safeDate = String(dateStr || "").trim();
  if (!safeDate) return { ok: false, error: "MISSING_DATE" };

  const cal = document.getElementById("calendar");
  if (!cal) return { ok: false, error: "CALENDAR_NOT_FOUND" };

  const cell = cal.querySelector(`.day[data-date="${safeDate}"]`);
  if (!cell) return { ok: false, error: "DAY_CELL_NOT_FOUND", dateStr: safeDate };

  const dayEvents = util.getEventsOnDate(safeDate, state.logic.events || []);

  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) {
    monthLabel.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    cal.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  cell.classList.add("calendarListFlash");
  setTimeout(() => {
    cell.classList.remove("calendarListFlash");
  }, 900);

  setTimeout(() => {
    showCalendarDayPopover(cell, safeDate, dayEvents);
  }, 120);

  return {
    ok: true,
    dateStr: safeDate,
    eventsCount: dayEvents.length
  };
}

App.ui = {
  ...(App.ui || {}),
  removeCalendarPopover,
  showCalendarEventPopover,
  showCalendarDayPopover,
  openCalendarDay,
  openCalendarDayByDate
};
})();