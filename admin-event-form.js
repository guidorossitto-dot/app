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
      const weeklyMultiDayValuesEl = document.getElementById("weeklyMultiDayValues");
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");
    const linkEl = document.getElementById("eventLink");
    const flyerEl = document.getElementById("eventFlyerUrl");
    const pricingTypeEl = document.getElementById("eventPricingType");
    const priceNoteEl = document.getElementById("eventPriceNote");
    const venueMenuUrlEl = document.getElementById("venueMenuUrl");
    const venueGuideGroupEl = document.getElementById("venueGuideGroup");
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
        flyerEl,
        pricingTypeEl,
        priceNoteEl,
        venueMenuUrlEl,
        venueGuideGroupEl,
        weeklyMultiDayValuesEl,
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
        flyerUrl: flyerEl?.value.trim() || "",
        pricingType: pricingTypeEl?.value || "unknown",
        priceNote: priceNoteEl?.value.trim() || "",
        venueMenuUrl: venueMenuUrlEl?.value.trim() || "",
        venueGuideGroup: venueGuideGroupEl?.value.trim() || "",
        weeklyMultiDayValues: weeklyMultiDayValuesEl?.value.trim() || "",
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
  (
    v.createMode === "dailyRange" ||
    v.createMode === "weeklyRange" ||
    v.createMode === "weeklyMultiDayRange"
  ) &&
  (!v.date || !v.endDate)
) {
  return {
    ok: false,
    error: "MISSING_RANGE",
    message: "Completá fecha inicio y fecha fin."
  };
}

if (v.createMode === "weeklyMultiDayRange" && !v.weeklyMultiDayValues) {
  return {
    ok: false,
    error: "MISSING_WEEKDAYS",
    message: "Elegí al menos un día de la semana."
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
      link: formValues.link,
      flyerUrl: formValues.flyerUrl,
      pricingType: formValues.pricingType || "unknown",
      priceNote: formValues.priceNote || ""
    };
  }

    function resetAdminEventForm(template = {}) {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");
    const linkEl = document.getElementById("eventLink");
    const flyerEl = document.getElementById("eventFlyerUrl");
    const pricingTypeEl = document.getElementById("eventPricingType");
    const priceNoteEl = document.getElementById("eventPriceNote");
    const venueMenuUrlEl = document.getElementById("venueMenuUrl");
    const venueGuideGroupEl = document.getElementById("venueGuideGroup");
    const addBtn = document.getElementById("addEventBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const createModeEl = document.getElementById("eventCreateMode");
    const endDateEl = document.getElementById("eventEndDate");
    const endDateLabelEl = document.getElementById("eventEndDateLabel");
    const venueSearchInput = document.getElementById("venueSearchInput");
    const venueSuggestions = document.getElementById("venueSuggestions");
    const weeklyMultiDayValuesEl = document.getElementById("weeklyMultiDayValues");
    const weeklyMultiDayPickerEl = document.getElementById("weeklyMultiDayPicker");
    const weeklyMultiDayChipsRow = document.getElementById("weeklyMultiDayChips");

    if (weeklyMultiDayValuesEl) weeklyMultiDayValuesEl.value = "";
    if (weeklyMultiDayPickerEl) weeklyMultiDayPickerEl.hidden = true;

    if (weeklyMultiDayChipsRow) {
      [...weeklyMultiDayChipsRow.querySelectorAll("[data-dow]")].forEach((btn) => {
        btn.classList.remove("isActive");
      });
    }

    if (titleEl) titleEl.value = "";
    if (dateEl) dateEl.value = "";
    if (latEl) latEl.value = "";
    if (lngEl) lngEl.value = "";
    if (placeEl) placeEl.value = "";
    if (startEl) startEl.value = "";
    if (catEl) catEl.value = "music";
    if (linkEl) linkEl.value = "";
    if (venueMenuUrlEl) venueMenuUrlEl.value = "";
    if (venueGuideGroupEl) venueGuideGroupEl.value = template.venueGuideGroup || "";
    if (flyerEl) flyerEl.value = "";
    if (pricingTypeEl) pricingTypeEl.value = template.pricingType || "unknown";
    if (priceNoteEl) priceNoteEl.value = template.priceNote || "";
    if (createModeEl) {
    createModeEl.value = template.createMode || "single";
}

if (endDateEl) {
  endDateEl.value = template.endDate || "";
}

if (endDateLabelEl) {
  const mode = template.createMode || "single";
  const showEndDate =
    mode === "dailyRange" ||
    mode === "weeklyRange" ||
    mode === "weeklyMultiDayRange";

  endDateLabelEl.hidden = !showEndDate;
  endDateEl.hidden = !showEndDate;
}

    if (addBtn) addBtn.textContent = "Agregar evento";
    if (cancelBtn) cancelBtn.hidden = true;

    App.actions?.stopEditingEvent?.();
    App.actions?.setEditingMode?.(null);
    App.actions?.setEditingSeriesId?.(null);

    App.map?.clearEventCreationMarker?.();
  }

  function recycleAdminEventForm(template = {}) {
    const titleEl = document.getElementById("eventTitle");
    const dateEl = document.getElementById("eventDate");
    const latEl = document.getElementById("eventLat");
    const lngEl = document.getElementById("eventLng");
    const placeEl = document.getElementById("eventPlace");
    const startEl = document.getElementById("eventStart");
    const catEl = document.getElementById("eventCategory");
    const linkEl = document.getElementById("eventLink");
    const flyerEl = document.getElementById("eventFlyerUrl");
    const pricingTypeEl = document.getElementById("eventPricingType");
    const priceNoteEl = document.getElementById("eventPriceNote");
    const venueMenuUrlEl = document.getElementById("venueMenuUrl");
    const venueGuideGroupEl = document.getElementById("venueGuideGroup");

    const addBtn = document.getElementById("addEventBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");

    const createModeEl = document.getElementById("eventCreateMode");
    const endDateEl = document.getElementById("eventEndDate");
    const endDateLabelEl = document.getElementById("eventEndDateLabel");

    const venueSearchInput = document.getElementById("venueSearchInput");
    const venueSuggestions = document.getElementById("venueSuggestions");

    const weeklyMultiDayValuesEl = document.getElementById("weeklyMultiDayValues");
    const weeklyMultiDayPickerEl = document.getElementById("weeklyMultiDayPicker");
    const weeklyMultiDayChipsRow = document.getElementById("weeklyMultiDayChips");

    const safeLat = Number(template.lat);
    const safeLng = Number(template.lng);

    if (titleEl) titleEl.value = template.title || "";
    if (dateEl) dateEl.value = template.date || "";
    if (latEl) latEl.value = Number.isFinite(safeLat) ? safeLat.toFixed(6) : "";
    if (lngEl) lngEl.value = Number.isFinite(safeLng) ? safeLng.toFixed(6) : "";
    if (placeEl) placeEl.value = template.placeName || "";

    if (startEl) startEl.value = "";

    if (catEl) catEl.value = template.category || "music";
    if (linkEl) linkEl.value = template.link || "";
    if (flyerEl) flyerEl.value = template.flyerUrl || "";
    if (pricingTypeEl) pricingTypeEl.value = template.pricingType || "unknown";
    if (priceNoteEl) priceNoteEl.value = template.priceNote || "";
    if (venueMenuUrlEl) venueMenuUrlEl.value = template.venueMenuUrl || "";
    if (venueGuideGroupEl) venueGuideGroupEl.value = template.venueGuideGroup || "";

  if (createModeEl) {
  createModeEl.value = template.createMode || "single";
}

if (endDateEl) {
  endDateEl.value = template.endDate || "";
}

if (weeklyMultiDayValuesEl) {
  weeklyMultiDayValuesEl.value = template.weeklyMultiDayValues || "";
}

const selectedDays = String(template.weeklyMultiDayValues || "")
  .split(",")
  .map((v) => Number(v))
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

if (weeklyMultiDayChipsRow) {
  [...weeklyMultiDayChipsRow.querySelectorAll("[data-dow]")].forEach((btn) => {
    const dow = Number(btn.dataset.dow);
    btn.classList.toggle("isActive", selectedDays.includes(dow));
  });
}

if (createModeEl) {
  createModeEl.dispatchEvent(new Event("change", { bubbles: true }));
} else {
  const mode = template.createMode || "single";
  const showEndDate =
    mode === "dailyRange" ||
    mode === "weeklyRange" ||
    mode === "weeklyMultiDayRange";

  const showWeeklyMultiDay = mode === "weeklyMultiDayRange";

  if (endDateEl) endDateEl.hidden = !showEndDate;
  if (endDateLabelEl) endDateLabelEl.hidden = !showEndDate;
  if (weeklyMultiDayPickerEl) weeklyMultiDayPickerEl.hidden = !showWeeklyMultiDay;
}

    if (venueSearchInput) {
      venueSearchInput.value = template.venueSearchQuery || template.placeName || "";
    }
    if (venueSuggestions) venueSuggestions.innerHTML = "";

    if (App.venues?.clearSelectedVenueForAdmin) {
      App.venues.clearSelectedVenueForAdmin();
    }

    if (template.selectedVenueId && App.venues?.selectVenueForAdmin) {
      App.venues.selectVenueForAdmin(template.selectedVenueId);
    }

    const adminRow = document.getElementById("adminCategoryChips");
    if (adminRow) {
      const chips = [...adminRow.querySelectorAll(".chip[data-cat]")];
      chips.forEach((b) =>
        b.classList.toggle("isActive", b.dataset.cat === (template.category || "music"))
      );
    }

    if (addBtn) addBtn.textContent = "Agregar evento";
    if (cancelBtn) cancelBtn.hidden = true;

    App.actions?.stopEditingEvent?.();
    App.actions?.setEditingMode?.(null);
    App.actions?.setEditingSeriesId?.(null);

    if (App.map?.prepareEventCreation && Number.isFinite(safeLat) && Number.isFinite(safeLng)) {
      App.map.prepareEventCreation(safeLat, safeLng);
    }

    if (startEl) {
      startEl.scrollIntoView({ behavior: "smooth", block: "center" });
      startEl.focus();
    }
  }

  async function createEventFromAdminForm(options = {}) {
    const keepTemplate = !!options.keepTemplate;

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
    flyerUrl,
    pricingType,
    priceNote,
    venueMenuUrl,
    venueGuideGroup,
    createMode,
    endDate,
    weeklyMultiDayValues
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
      link,
      flyerUrl,
      pricingType,
      priceNote
    });

    const editingId = String(state.logic.editingEventId || "").trim() || null;
    let recycleTemplate = null;

    if (editingId) {
      const result = await App.events?.saveEditedEvent?.(
        {
          editingEventId: editingId,
          editingMode: state.logic.editingMode,
          editingSeriesId: state.logic.editingSeriesId
        },
        patch
      );

      if (!result?.ok) {
        alert("No se pudo guardar la edición.");
        return;
      }

      App.actions?.stopEditingEvent?.();
      App.actions?.setEditingMode?.(null);
      App.actions?.setEditingSeriesId?.(null);
    } else {
      const baseEvent = { ...patch };
      let eventsToCreate = [];

      if (createMode === "weeklyMultiDayRange") {
        const weekdays = String(weeklyMultiDayValues || "")
          .split(",")
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

        if (!endDate) {
          alert("Completá fecha inicio y fecha fin.");
          return;
        }

        if (!weekdays.length) {
          alert("Elegí al menos un día de la semana.");
          return;
        }

        const start = new Date(`${date}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
          alert("Revisá el rango de fechas.");
          return;
        }

        const wantedSet = new Set(weekdays);

        const seriesId =
          (typeof crypto !== "undefined" && crypto.randomUUID)
            ? crypto.randomUUID()
            : `series_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const cur = new Date(start);

        while (cur <= end) {
          const dow = cur.getDay();

          if (wantedSet.has(dow)) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, "0");
            const d = String(cur.getDate()).padStart(2, "0");

            eventsToCreate.push({
              ...baseEvent,
              date: `${y}-${m}-${d}`,
              seriesId,
              recurrenceType: "weekly_multi_day",
              recurrenceUntil: endDate
            });
          }

          cur.setDate(cur.getDate() + 1);

          if (eventsToCreate.length > 366) break;
        }
      } else {
        const buildResult = App.events?.buildEventsFromCreateMode?.(baseEvent, {
          mode: createMode,
          startDate: date,
          endDate
        });

        if (!buildResult?.ok) {
          alert(buildResult?.message || "No se pudieron preparar los eventos.");
          return;
        }

        eventsToCreate = buildResult.events || [];
      }

      const saveResult = await App.events?.addEventsRemote?.(eventsToCreate);

      if (!saveResult?.ok) {
        alert("No se pudo guardar uno de los eventos.");
        return;
      }

      const ensuredVenueResult = await App.venues?.ensureVenueExistsFromEventData?.({
        placeName,
        lat,
        lng,
        guideGroup: venueGuideGroup
      });

      if (!ensuredVenueResult?.ok) {
        console.warn("No se pudo asegurar el venue del evento.");
      } else if (venueMenuUrl) {
        await App.venues?.updateVenueRemote?.(ensuredVenueResult.venue.id, {
          menuUrl: venueMenuUrl
        });
      }

   const createdCount = Number(saveResult?.createdCount || 0);

if (keepTemplate && createdCount >= 1) {
  recycleTemplate = {
    title,
    date,
    lat,
    lng,
    placeName,
    category,
    link,
    flyerUrl,
    pricingType,
    priceNote,  
    venueMenuUrl,
    venueGuideGroup,
    createMode,
    endDate,
    weeklyMultiDayValues,
    selectedVenueId: state.logic.selectedVenueId || null,
    venueSearchQuery:
      document.getElementById("venueSearchInput")?.value.trim() || ""
  };
}

      if (createdCount > 1) {
        alert(`Se crearon ${createdCount} eventos.`);
      }
    }

    if (recycleTemplate) {
      recycleAdminEventForm(recycleTemplate);
    } else {
      resetAdminEventForm();

      if (addBtn) addBtn.textContent = "Agregar evento";
      if (cancelBtn) cancelBtn.hidden = true;
    }

    App.commit?.({
      persist: false,
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
    const flyerEl = document.getElementById("eventFlyerUrl");
    const pricingTypeEl = document.getElementById("eventPricingType");
    const priceNoteEl = document.getElementById("eventPriceNote");
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
    if (flyerEl) flyerEl.value = evData.flyerUrl || "";
    if (pricingTypeEl) pricingTypeEl.value = evData.pricingType || "unknown";
    if (priceNoteEl) priceNoteEl.value = evData.priceNote || "";

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

    function readAdminVenueFormValues() {
    const nameEl = document.getElementById("adminVenueName");
    const addressEl = document.getElementById("adminVenueAddress");
    const neighborhoodEl = document.getElementById("adminVenueNeighborhood");
    const latEl = document.getElementById("adminVenueLat");
    const lngEl = document.getElementById("adminVenueLng");
    const guideGroupEl = document.getElementById("adminVenueGuideGroup");
    const instagramUrlEl = document.getElementById("adminVenueInstagramUrl");
    const websiteUrlEl = document.getElementById("adminVenueWebsiteUrl");
    const menuUrlEl = document.getElementById("adminVenueMenuUrl");

    return {
      els: {
        nameEl,
        addressEl,
        neighborhoodEl,
        latEl,
        lngEl,
        guideGroupEl,
        instagramUrlEl,
        websiteUrlEl,
        menuUrlEl
      },

      values: {
        name: nameEl?.value.trim() || "",
        address: addressEl?.value.trim() || "",
        neighborhood: neighborhoodEl?.value.trim() || "",
        lat: Number(latEl?.value),
        lng: Number(lngEl?.value),
        guideGroup: guideGroupEl?.value.trim() || "",
        instagramUrl: instagramUrlEl?.value.trim() || "",
        websiteUrl: websiteUrlEl?.value.trim() || "",
        menuUrl: menuUrlEl?.value.trim() || ""
      }
    };
  }

  function setAdminVenueStatus(message = "", type = "") {
    const statusEl = document.getElementById("adminVenueStatus");
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.dataset.status = type || "";
  }

  function validateAdminVenueFormValues(form) {
    const v = form?.values || {};

    if (!v.name) {
      return {
        ok: false,
        message: "Completá el nombre del lugar."
      };
    }

    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) {
      return {
        ok: false,
        message: "Completá latitud y longitud válidas."
      };
    }

    if (!v.guideGroup) {
      return {
        ok: false,
        message: "Elegí un tipo de lugar para que aparezca en la guía."
      };
    }

    return { ok: true };
  }

  function resetAdminVenueForm() {
    const form = readAdminVenueFormValues();
    const { els } = form;

    Object.values(els).forEach((el) => {
      if (!el) return;
      el.value = "";
    });

    setAdminVenueStatus("");
  }

  async function saveVenueFromAdminForm() {
    if (!util.canManageUI()) {
      alert("No tenés permisos para guardar lugares.");
      return;
    }

    const saveBtn = document.getElementById("saveVenueBtn");
    const form = readAdminVenueFormValues();
    const validation = validateAdminVenueFormValues(form);

    if (!validation.ok) {
      setAdminVenueStatus(validation.message || "Revisá los datos del lugar.", "error");
      alert(validation.message || "Revisá los datos del lugar.");
      return;
    }

    const v = form.values;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando...";
    }

    setAdminVenueStatus("Guardando lugar...", "loading");

    try {
      const result = await App.venues?.addVenueRemote?.({
        name: v.name,
        address: v.address,
        neighborhood: v.neighborhood,
        lat: v.lat,
        lng: v.lng,
        guideGroup: v.guideGroup,
        instagramUrl: v.instagramUrl,
        websiteUrl: v.websiteUrl,
        menuUrl: v.menuUrl
      });

      if (!result?.ok) {
        console.error("No se pudo guardar el lugar.", result?.error);
        setAdminVenueStatus("No se pudo guardar el lugar.", "error");
        alert("No se pudo guardar el lugar.");
        return;
      }

      if (result.duplicate) {
        setAdminVenueStatus("Ese lugar ya existía. No se creó un duplicado.", "warning");
        alert("Ese lugar ya existía. No se creó un duplicado.");
        return;
      }

      setAdminVenueStatus("Lugar guardado correctamente.", "success");

      resetAdminVenueForm();

      App.commit?.({
        persist: false,
        purgePast: false,
        rebuildMarkers: false,
        recomputeNearby: false
      });
    } catch (err) {
      console.error("Error guardando lugar desde admin.", err);
      setAdminVenueStatus("Error inesperado al guardar el lugar.", "error");
      alert("Error inesperado al guardar el lugar.");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar lugar";
      }
    }
  }

  function bindAdminVenueForm() {
    const saveBtn = document.getElementById("saveVenueBtn");
    const resetBtn = document.getElementById("resetVenueBtn");

    if (saveBtn && saveBtn.dataset.bound !== "true") {
      saveBtn.dataset.bound = "true";
      saveBtn.addEventListener("click", saveVenueFromAdminForm);
    }

    if (resetBtn && resetBtn.dataset.bound !== "true") {
      resetBtn.dataset.bound = "true";
      resetBtn.addEventListener("click", resetAdminVenueForm);
    }
  }

  function initAdminVenueFormBinding() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindAdminVenueForm);
    } else {
      bindAdminVenueForm();
    }
  }

  initAdminVenueFormBinding();

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
    recycleAdminEventForm,
    createEventFromAdminForm,

    readAdminVenueFormValues,
    validateAdminVenueFormValues,
    resetAdminVenueForm,
    saveVenueFromAdminForm,
    bindAdminVenueForm
    
  };
})();