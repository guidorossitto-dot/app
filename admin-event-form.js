// admin-event-form.js
(() => {
  "use strict";

  const App = window.App;
  const { util, state } = App;


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

  function readAdminEventFormValues() {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");
    const linkEl = document.getElementById("eventLink");
    const createModeEl = document.getElementById("eventCreateMode");
    const endDateEl = document.getElementById("eventEndDate");

    return {
      els: {
        titleEl,
        dateEl,
        latEl,
        lngEl,
        placeEl,
        startEl,
        catEl,
        linkEl,
        createModeEl,
        endDateEl
      },

      values: {
        title: titleEl?.value.trim() || "",
        date: dateEl?.value.trim() || "",
        lat: Number(latEl?.value),
        lng: Number(lngEl?.value),
        placeName: placeEl?.value.trim() || "",
        startTime: startEl?.value.trim() || "",
        category: catEl?.value || "music",
        link: linkEl?.value.trim() || "",
        createMode: createModeEl?.value || "single",
        endDate: endDateEl?.value?.trim() || ""
      }
    };
  }

  function validateAdminEventFormValues(form) {
    const v = form?.values || {};

    if (
      !v.title ||
      !v.date ||
      !v.placeName ||
      !Number.isFinite(v.lat) ||
      !Number.isFinite(v.lng)
    ) {
      return {
        ok: false,
        error: "INVALID_FORM",
        message: "Completá título, fecha, lugar y coordenadas válidas."
      };
    }

    if (
      (v.createMode === "dailyRange" || v.createMode === "weeklyRange") &&
      (!v.date || !v.endDate)
    ) {
      return {
        ok: false,
        error: "MISSING_RANGE",
        message: "Completá fecha inicio y fecha fin."
      };
    }

    return { ok: true };
  }

  function buildBaseEventPatch(formValues) {
    return {
      title: formValues.title,
      date: formValues.date,
      lat: formValues.lat,
      lng: formValues.lng,
      placeName: formValues.placeName,
      startTime: formValues.startTime,
      category: formValues.category,
      link: formValues.link
    };
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
    const addBtn = document.getElementById("addEventBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");

    const form = readAdminEventFormValues();
    const { els, values } = form;

    const { latEl, lngEl, placeEl } = els;

    if (!els.titleEl || !els.dateEl || !els.latEl || !els.lngEl) return;

    const validation = validateAdminEventFormValues(form);
    if (!validation.ok) {
      alert(validation.message || "Revisá los datos del formulario.");
      return;
    }

    let {
      title,
      date,
      lat,
      lng,
      placeName,
      startTime,
      category,
      link,
      createMode,
      endDate
    } = values;

    const canonical = findCanonicalPlace(placeName, lat, lng);
    if (canonical) {
      lat = canonical.lat;
      lng = canonical.lng;
      placeName = canonical.placeName;

      if (latEl) latEl.value = Number(lat).toFixed(6);
      if (lngEl) lngEl.value = Number(lng).toFixed(6);
      if (placeEl) placeEl.value = util.shortPlaceName(placeName);
    }

    const patch = buildBaseEventPatch({
      title,
      date,
      lat,
      lng,
      placeName,
      startTime,
      category,
      link
    });

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
      const mode = createMode;
      const baseEvent = { ...patch };

      let eventsToCreate = [];

      if (mode === "dailyRange") {
        if (!date || !endDate) {
          alert("Completá fecha inicio y fecha fin.");
          return;
        }

        eventsToCreate = App.events?.generateDailyOccurrences?.(baseEvent, date, endDate) || [];

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

        eventsToCreate = App.events?.generateWeeklyOccurrences?.(baseEvent, date, endDate) || [];
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

    function applyEventToAdminForm(evData) {
    if (!evData) return { ok: false, error: "MISSING_EVENT" };

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

    if (titleEl) titleEl.value = evData.title || "";
    if (dateEl) dateEl.value = evData.date || "";
    if (latEl) latEl.value = Number(evData.lat).toFixed(6);
    if (lngEl) lngEl.value = Number(evData.lng).toFixed(6);
    if (placeEl) placeEl.value = evData.placeName || "";
    if (startEl) startEl.value = evData.startTime || "";
    if (catEl) catEl.value = evData.category || "music";
    if (linkEl) linkEl.value = evData.link || "";

    const adminRow = document.getElementById("adminCategoryChips");
    if (adminRow) {
      const chips = [...adminRow.querySelectorAll(".chip[data-cat]")];
      chips.forEach((b) =>
        b.classList.toggle("isActive", b.dataset.cat === (evData.category || "music"))
      );
    }

    if (addBtn) addBtn.textContent = "Guardar cambios";
    if (cancelBtn) cancelBtn.hidden = false;

    return { ok: true };
  }

  function askEditModeForEvent(evData) {
    if (!evData) return { ok: false, error: "MISSING_EVENT" };

    const seriesId = String(evData.seriesId || "").trim();
    let editMode = "single";

    if (seriesId) {
      const choice = window.prompt(
        `El evento "${evData.title || "sin título"}" pertenece a una serie.\n\n` +
        `Escribí:\n` +
        `1 = editar solo este evento\n` +
        `2 = editar toda la serie`
      );

      if (choice === null) {
        return { ok: false, error: "CANCELLED" };
      }

      const normalizedChoice = String(choice).trim();

      if (normalizedChoice === "2") {
        editMode = "series";
      } else if (normalizedChoice === "1") {
        editMode = "single";
      } else {
        alert("Opción no válida. Escribí 1 o 2.");
        return { ok: false, error: "INVALID_CHOICE" };
      }
    }

    return {
      ok: true,
      editMode,
      seriesId: seriesId || null
    };
  }

  function focusAdminTitleInput() {
    const titleTarget = document.getElementById("eventTitle");
    if (!titleTarget) return;

    titleTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    titleTarget.focus();
  }

  function startEditingEventFromId(eventId) {
    const id = String(eventId || "").trim();
    if (!id) return { ok: false, error: "MISSING_ID" };

    if (!util.canManageUI()) {
      alert("No tenés permisos para editar eventos.");
      return { ok: false, error: "FORBIDDEN" };
    }

    const evData = App.events?.findEventById?.(id);
    if (!evData) {
      alert("No se encontró el evento.");
      return { ok: false, error: "NOT_FOUND" };
    }

    const modeResult = askEditModeForEvent(evData);
    if (!modeResult?.ok) return modeResult;

    App.actions?.startEditingEvent?.(id);
    App.actions?.selectCategory?.("all");
    App.actions?.setEditingMode?.(modeResult.editMode);
    App.actions?.setEditingSeriesId?.(modeResult.seriesId || null);

    applyEventToAdminForm(evData);

    if (App.map?.prepareEventCreation) {
      App.map.prepareEventCreation(evData.lat, evData.lng);
    }

    if (App.map?.focusPlaceByCoords) {
      App.map.focusPlaceByCoords(
        Number(evData.lat),
        Number(evData.lng),
        util.shortPlaceName(evData.placeName) || "Lugar sin nombre",
        evData.title || "Evento",
        15
      );
    }

    focusAdminTitleInput();

    return {
      ok: true,
      event: evData,
      editMode: modeResult.editMode,
      seriesId: modeResult.seriesId || null
    };
  }

  App.adminForm = {
    ...(App.adminForm || {}),
    findCanonicalPlace,
    readAdminEventFormValues,
    validateAdminEventFormValues,
    buildBaseEventPatch,
    applyEventToAdminForm,
    askEditModeForEvent,
    focusAdminTitleInput,
    startEditingEventFromId,
    resetAdminEventForm,
    createEventFromAdminForm
  };
})();