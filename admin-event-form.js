// admin-event-form.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;

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
    const seriesId = util.newId();

    while (cur <= end) {
      out.push({
        ...baseEvent,
        id: util.newId(),
        date: formatYMD(cur),
        seriesId,
        recurrenceType: "daily",
        recurrenceInterval: 1,
        recurrenceUntil: endDate
      });

      cur.setDate(cur.getDate() + 1);

      if (out.length > 60) break;
    }

    return out;
  }

  function generateWeeklyOccurrences(baseEvent, startDate, endDate) {
    const out = [];
    if (!baseEvent || !startDate || !endDate) return out;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
    if (start > end) return out;

    const cur = new Date(start);
    const seriesId = util.newId();

    while (cur <= end) {
      out.push({
        ...baseEvent,
        id: util.newId(),
        date: formatYMD(cur),
        seriesId,
        recurrenceType: "weekly",
        recurrenceInterval: 1,
        recurrenceUntil: endDate
      });

      cur.setDate(cur.getDate() + 7);

      if (out.length > 60) break;
    }

    return out;
  }

  function normalizePlaceText(s) {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function findCanonicalPlace(placeName, lat, lng) {
    const targetName = normalizePlaceText(util.shortPlaceName(placeName));
    const all = state.logic.events || [];

    if (!util.isValidCoord(lat) || !util.isValidCoord(lng)) return null;
    if (!targetName) return null;

    let best = null;

    for (const ev of all) {
      if (!ev || !util.isValidCoord(ev.lat) || !util.isValidCoord(ev.lng)) continue;

      const evName = normalizePlaceText(util.shortPlaceName(ev.placeName));
      const dist = util.distanceKm(lat, lng, ev.lat, ev.lng);

      const sameName = !!evName && targetName === evName;
      const nearAndSameName = sameName && dist <= 0.12;

      if (!nearAndSameName) continue;

      if (!best || dist < best.dist) {
        best = {
          lat: ev.lat,
          lng: ev.lng,
          placeName: ev.placeName || placeName,
          dist
        };
      }
    }

    return best;
  }

  function resetAdminEventForm() {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");
    const linkEl = document.getElementById("eventLink");
    const addBtn = document.getElementById("addEventBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const createModeEl = document.getElementById("eventCreateMode");
    const endDateEl = document.getElementById("eventEndDate");
    const endDateLabelEl = document.getElementById("eventEndDateLabel");
    const venueSearchInput = document.getElementById("venueSearchInput");
    const venueSuggestions = document.getElementById("venueSuggestions");

    if (titleEl) titleEl.value = "";
    if (dateEl) dateEl.value = "";
    if (latEl) latEl.value = "";
    if (lngEl) lngEl.value = "";
    if (placeEl) placeEl.value = "";
    if (startEl) startEl.value = "";
    if (catEl) catEl.value = "music";
    if (linkEl) linkEl.value = "";
    if (createModeEl) createModeEl.value = "single";

    if (endDateEl) {
      endDateEl.value = "";
      endDateEl.hidden = true;
    }

    if (endDateLabelEl) endDateLabelEl.hidden = true;
    if (venueSearchInput) venueSearchInput.value = "";
    if (venueSuggestions) venueSuggestions.innerHTML = "";

    if (App.venues?.clearSelectedVenueForAdmin) {
      App.venues.clearSelectedVenueForAdmin();
    }

    const adminRow = document.getElementById("adminCategoryChips");
    if (adminRow) {
      const chips = [...adminRow.querySelectorAll(".chip[data-cat]")];
      chips.forEach((b) => b.classList.toggle("isActive", b.dataset.cat === "music"));
    }

    if (addBtn) addBtn.textContent = "Agregar evento";
    if (cancelBtn) cancelBtn.hidden = true;

    App.actions?.stopEditingEvent?.();
    App.actions?.setEditingMode?.(null);
    App.actions?.setEditingSeriesId?.(null);

    App.map?.clearEventCreationMarker?.();
  }

  async function createEventFromAdminForm() {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");
    const linkEl = document.getElementById("eventLink");
    const addBtn = document.getElementById("addEventBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const createModeEl = document.getElementById("eventCreateMode");
    const endDateEl = document.getElementById("eventEndDate");

    if (!titleEl || !dateEl || !latEl || !lngEl) return;

    const title = titleEl.value.trim();
    const date = dateEl.value.trim();
    let lat = Number(latEl.value);
    let lng = Number(lngEl.value);
    let placeName = placeEl ? placeEl.value.trim() : "";
    const startTime = startEl ? startEl.value.trim() : "";
    const category = catEl ? catEl.value : "music";
    const link = linkEl ? linkEl.value.trim() : "";

    if (
      !title ||
      !date ||
      !placeName ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      alert("Completá título, fecha, lugar y coordenadas válidas.");
      return;
    }

    const canonical = findCanonicalPlace(placeName, lat, lng);
    if (canonical) {
      lat = canonical.lat;
      lng = canonical.lng;
      placeName = canonical.placeName;

      if (latEl) latEl.value = Number(lat).toFixed(6);
      if (lngEl) lngEl.value = Number(lng).toFixed(6);
      if (placeEl) placeEl.value = util.shortPlaceName(placeName);
    }

    const patch = {
      title,
      date,
      lat,
      lng,
      placeName,
      startTime,
      category,
      link
    };

    const editingId = String(state.logic.editingEventId || "").trim() || null;

    if (editingId) {
      const editMode = state.logic.editingMode || "single";
      const editSeriesId = String(state.logic.editingSeriesId || "").trim();

      let result = null;

      if (editMode === "series" && editSeriesId) {
        result = await App.events?.replaceSeries?.(editSeriesId, patch);
      } else {
        result = await App.events?.replaceEvent?.(editingId, patch);
      }

      if (!result?.ok) {
        alert("No se pudo guardar la edición.");
        return;
      }

      App.actions?.stopEditingEvent?.();
      App.actions?.setEditingMode?.(null);
      App.actions?.setEditingSeriesId?.(null);
    } else {
      const mode = createModeEl?.value || "single";
      const endDate = endDateEl?.value?.trim() || "";
      const baseEvent = { ...patch };

      let eventsToCreate = [];

      if (mode === "dailyRange") {
        if (!date || !endDate) {
          alert("Completá fecha inicio y fecha fin.");
          return;
        }

        eventsToCreate = generateDailyOccurrences(baseEvent, date, endDate);

        if (!eventsToCreate.length) {
          alert("No se pudieron generar ocurrencias. Revisá el rango de fechas.");
          return;
        }

        if (eventsToCreate.length > 60) {
          alert("Demasiadas ocurrencias. Reducí el rango.");
          return;
        }
      } else if (mode === "weeklyRange") {
        if (!date || !endDate) {
          alert("Completá fecha inicio y fecha fin.");
          return;
        }

        eventsToCreate = generateWeeklyOccurrences(baseEvent, date, endDate);

        if (!eventsToCreate.length) {
          alert("No se pudieron generar ocurrencias semanales. Revisá el rango.");
          return;
        }

        if (eventsToCreate.length > 60) {
          alert("Demasiadas ocurrencias. Reducí el rango.");
          return;
        }
      } else {
        eventsToCreate = [
          {
            id: util.newId(),
            seriesId: "",
            recurrenceType: "",
            recurrenceInterval: null,
            recurrenceUntil: "",
            ...baseEvent
          }
        ];
      }

      for (const ev of eventsToCreate) {
        const result = await App.events?.addEventRemote?.(ev);

        if (!result?.ok) {
          alert("No se pudo guardar uno de los eventos.");
          return;
        }
      }

      if (App.venues?.addVenueRemote && App.venues?.listVenues) {
        const existingVenue = App.venues
          .listVenues()
          .find((v) => {
            const sameName =
              String(v?.name || "").trim().toLowerCase() === placeName.toLowerCase();
            const sameLat = Number(v?.lat) === lat;
            const sameLng = Number(v?.lng) === lng;
            return sameName && sameLat && sameLng;
          });

        if (!existingVenue) {
          await App.venues.addVenueRemote({
            name: placeName,
            address: placeName,
            lat,
            lng
          });
        }
      }

      if (eventsToCreate.length > 1) {
        alert(`Se crearon ${eventsToCreate.length} eventos.`);
      }
    }

    resetAdminEventForm();

    if (addBtn) addBtn.textContent = "Agregar evento";
    if (cancelBtn) cancelBtn.hidden = true;

    App.commit?.({
      persist: true,
      purgePast: false,
      rebuildMarkers: true,
      recomputeNearby: true
    });
  }

  App.adminForm = {
    ...(App.adminForm || {}),
    findCanonicalPlace,
    generateDailyOccurrences,
    generateWeeklyOccurrences,
    resetAdminEventForm,
    createEventFromAdminForm
  };
})();