// ui-calendar-popover.js
(() => {
  "use strict";

  const App = window.App;
  const { state, util } = App;

  function removeCalendarPopover() {
    const old = document.getElementById("calendarEventPopover");
    if (old) old.remove();
  }

function goToEventOnMap(ev) {
  if (!ev) return false;

  const mapStage =
    document.querySelector(".mapStage") ||
    document.getElementById("map") ||
    document.getElementById("mapSection");

  if (mapStage) {
    const top = mapStage.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth"
    });
  }

  setTimeout(() => {
    let opened = false;

    if (App.map?.focusEventById && ev.id) {
      opened = !!App.map.focusEventById(ev.id);
    }

    if (!opened && state.runtime.map && Number.isFinite(Number(ev.lat)) && Number.isFinite(Number(ev.lng))) {
      state.runtime.map.setView([Number(ev.lat), Number(ev.lng)], 16);
    }
  }, 260);

  return true;
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
    <div class="calendarEventPopover__header">
      <div class="calendarEventPopover__title">
        <span class="calendarEventIcon">${icon}</span>
        <span class="calendarEventTitleText">${ev.title || "Evento"}</span>
      </div>
      <button
        type="button"
        class="calendarPopoverXBtn"
        aria-label="Cerrar popup">
        ×
      </button>
    </div>

    <div class="calendarEventPopover__meta">
      ${time ? `<div><strong>Hora:</strong> ${time}</div>` : ""}
      <div><strong>Lugar:</strong> ${place}</div>
      <div><strong>Fecha:</strong> ${dateText}</div>
    </div>

    <div class="calendarEventPopover__actions">
      <button
        type="button"
        class="linkBtn favoriteBtn"
        data-eid="${encodeURIComponent(ev.id || "")}"
        aria-pressed="${App.events?.isFavorite?.(ev.id) ? "true" : "false"}">
        ${App.events?.isFavorite?.(ev.id) ? "❤️ Guardado" : "🤍 Guardar"}
      </button>

      <button type="button" class="linkBtn calendarPopoverMapBtn">Ver en mapa</button>

      <button
        type="button"
        class="linkBtn calendarPopoverShareBtn shareBtn"
        data-eid="${encodeURIComponent(ev.id || "")}"
        data-title="${encodeURIComponent(ev.title || "")}"
        data-place="${encodeURIComponent(util.shortPlaceName(ev.placeName) || "")}"
        data-date="${encodeURIComponent(ev.date || "")}"
        data-time="${encodeURIComponent(util.formatTimeStart(ev) || "")}"
        data-url="${location.origin}${location.pathname}#d=${encodeURIComponent(ev.date || "")}&e=${encodeURIComponent(ev.id || "")}">
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
    </div>
  `;

  document.body.appendChild(pop);

  pop.addEventListener("click", (e) => {
    e.stopPropagation();
  });

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

  const closeBtn = pop.querySelector(".calendarPopoverXBtn");
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
    goToEventOnMap(ev);
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

  const favoriteBtn = pop.querySelector(".favoriteBtn");
  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = decodeURIComponent((favoriteBtn.dataset.eid || "").trim());
      if (!eventId) return;

      const result = App.actions?.toggleFavorite?.(eventId);
      if (!result?.ok) return;

      const isFav = !!result.isFavorite;
      favoriteBtn.setAttribute("aria-pressed", isFav ? "true" : "false");
      favoriteBtn.textContent = isFav ? "❤️ Guardado" : "🤍 Guardar";
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
      if (!pop.contains(e.target)) {
        removeCalendarPopover();
        document.removeEventListener("click", onDocClick);
      }
    };

    document.addEventListener("click", onDocClick);
  });
}

function showCalendarDayPopover(anchorEl, dateStr, events, opts = {}) {
  if (!anchorEl) return;

  removeCalendarPopover();

  const pop = document.createElement("div");
  pop.id = "calendarEventPopover";
  pop.className = "calendarEventPopover calendarEventPopover--dayList";

  const safeEvents = [...(events || [])].sort(util.sortEventsByStatusThenTime);
  const dateText = util.formatDateDisplay(dateStr);

  pop.innerHTML = `
    <div class="calendarEventPopover__header">
      <div class="calendarEventPopover__title">Eventos del ${dateText}</div>
      <button
        type="button"
        class="calendarPopoverXBtn"
        aria-label="Cerrar popup">
        ×
      </button>
    </div>

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
                                  class="linkBtn calendarDayPopoverFavoriteBtn"
                                  data-fav-eid="${encodeURIComponent(ev.id || "")}"
                                  aria-pressed="${App.events?.isFavorite?.(ev.id) ? "true" : "false"}">
                                  ${App.events?.isFavorite?.(ev.id) ? "❤️ Guardado" : "🤍 Guardar"}
                                </button>
                              `
                              : ""
                          }

                          ${
                            ev?.id
                              ? `
                                <button
                                  type="button"
                                  class="linkBtn calendarDayPopoverShareBtn"
                                  data-share-eid="${encodeURIComponent(ev.id || "")}"
                                  data-share-title="${encodeURIComponent(ev.title || "")}"
                                  data-share-place="${encodeURIComponent(util.shortPlaceName(ev.placeName) || "")}"
                                  data-share-date="${encodeURIComponent(ev.date || "")}"
                                  data-share-time="${encodeURIComponent(util.formatTimeStart(ev) || "")}"
                                  data-share-url="${location.origin}${location.pathname}#d=${encodeURIComponent(ev.date || "")}&e=${encodeURIComponent(ev.id || "")}">
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
  `;

  document.body.appendChild(pop);

  pop.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  const centered = !!opts.centered;

  if (centered) {
    const cal = document.getElementById("calendar");
    const calRect = cal?.getBoundingClientRect?.();

    pop.style.position = "absolute";
    pop.style.zIndex = "9999";

    if (calRect) {
      const popRect = pop.getBoundingClientRect();

      const top = window.scrollY + calRect.top + 40;
      const left = window.scrollX + calRect.left + Math.max(0, (calRect.width - popRect.width) / 2);

      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
    } else {
      pop.style.top = `${window.scrollY + 120}px`;
      pop.style.left = `${window.scrollX + 40}px`;
    }
  } else {
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
  }

  const closeBtn = pop.querySelector(".calendarPopoverXBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeCalendarPopover();
    });
  }

  pop.querySelectorAll(".calendarDayPopover__item[data-eid]").forEach((item) => {
  item.addEventListener("click", (e) => {
    const interactive = e.target.closest("a, button");
    if (interactive) return;

    e.preventDefault();
    e.stopPropagation();

    const eid = decodeURIComponent(item.dataset.eid || "");
    const ev = safeEvents.find((x) => String(x.id || "") === String(eid));
    if (!ev) return;

    removeCalendarPopover();
    goToEventOnMap(ev);
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
      btn.dataset.place = btn.dataset.sharePlace || "";
      btn.dataset.date = btn.dataset.shareDate || "";
      btn.dataset.time = btn.dataset.shareTime || "";
      btn.dataset.url = btn.dataset.shareUrl || "";

      await App.actions?.shareEventFlow?.({ button: btn });
    });
  });

  pop.querySelectorAll(".calendarDayPopoverFavoriteBtn[data-fav-eid]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = decodeURIComponent(btn.dataset.favEid || "");
      if (!eventId) return;

      const result = App.actions?.toggleFavorite?.(eventId);
      if (!result?.ok) return;

      const isFav = !!result.isFavorite;
      btn.setAttribute("aria-pressed", isFav ? "true" : "false");
      btn.textContent = isFav ? "❤️ Guardado" : "🤍 Guardar";
    });
  });

  pop.querySelectorAll('.calendarDayPopover__item a.linkBtn').forEach((link) => {
  link.addEventListener("click", (e) => {
    e.stopPropagation();
  });
});

  requestAnimationFrame(() => {
    const onDocClick = (e) => {
      if (!pop.contains(e.target)) {
        removeCalendarPopover();
        document.removeEventListener("click", onDocClick);
      }
    };

    document.addEventListener("click", onDocClick);
  });
}

  function openCalendarDay(dateStr, anchorEl = null) {
  const safeDate = String(dateStr || "").trim();
  if (!safeDate) return { ok: false, error: "MISSING_DATE" };

  const dayEvents = util.getEventsOnDate(safeDate, state.logic.events || []);

  if (anchorEl) {
    showCalendarDayPopover(anchorEl, safeDate, dayEvents);
    return {
      ok: true,
      dateStr: safeDate,
      eventsCount: dayEvents.length
    };
  }

  const cal = document.getElementById("calendar");
  if (!cal) return { ok: false, error: "CALENDAR_NOT_FOUND" };

  const cell = cal.querySelector(`.day[data-date="${safeDate}"]`);
  if (!cell) return { ok: false, error: "DAY_CELL_NOT_FOUND", dateStr: safeDate };

  showCalendarDayPopover(cell, safeDate, dayEvents);

  return {
    ok: true,
    dateStr: safeDate,
    eventsCount: dayEvents.length
  };
}

  function openCalendarDayByDate(dateStr, highlightEventId = null) {
  const safeDate = String(dateStr || "").trim();
  if (!safeDate) return { ok: false, error: "MISSING_DATE" };

  const cal = document.getElementById("calendar");
  if (!cal) return { ok: false, error: "CALENDAR_NOT_FOUND" };

  const cell = cal.querySelector(`.day[data-date="${safeDate}"]`);
  if (!cell) return { ok: false, error: "DAY_CELL_NOT_FOUND", dateStr: safeDate };

  const dayEvents = util.getEventsOnDate(safeDate, state.logic.events || []);

  removeCalendarPopover();
  App.ui?.clearListFocus?.();

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    cell.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    // ajuste fino por header (opcional)
    setTimeout(() => {
      window.scrollBy(0, -40);
    }, 200);
  });
});

  cell.classList.add("calendarListFlash");
  setTimeout(() => {
    cell.classList.remove("calendarListFlash");
  }, 900);

  setTimeout(() => {
    showCalendarDayPopover(cell, safeDate, dayEvents, { centered: true });

    if (highlightEventId) {
      setTimeout(() => {
        const pop = document.getElementById("calendarEventPopover");
        if (!pop) return;

        const encodedId = encodeURIComponent(String(highlightEventId || "").trim());

        const row = [...pop.querySelectorAll(".calendarDayPopover__item[data-eid]")]
          .find((el) => String(el.dataset.eid || "").trim() === encodedId);

        if (!row) return;

        row.classList.add("calendarListFlash");
        row.style.outline = "2px solid rgba(0,0,0,0.25)";
        row.style.borderRadius = "10px";
        row.style.background = "rgba(255, 230, 120, 0.35)";
        row.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
          row.classList.remove("calendarListFlash");
          row.style.outline = "";
          row.style.borderRadius = "";
          row.style.background = "";
        }, 1600);
      }, 120);
    }
  }, 520);

  return {
    ok: true,
    dateStr: safeDate,
    eventsCount: dayEvents.length,
    highlightEventId: highlightEventId || null
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