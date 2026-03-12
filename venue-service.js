// venue-service.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});
  const { state } = App;

  /* =========================
     HELPERS
  ========================= */

  function ensureVenueState() {
    if (!state.logic) state.logic = {};
    if (!Array.isArray(state.logic.venues)) state.logic.venues = [];
  }

  function ensureVenueUIState() {
    if (!state.logic) state.logic = {};
    if (typeof state.logic.adminVenueQuery !== "string") state.logic.adminVenueQuery = "";
    if (!Array.isArray(state.logic.adminVenueSuggestions)) state.logic.adminVenueSuggestions = [];
    if (!("selectedVenueId" in state.logic)) state.logic.selectedVenueId = null;
  }

  function safeString(value) {
    return String(value ?? "").trim();
  }

  function safeLower(value) {
    return safeString(value).toLowerCase();
  }

  function toNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function makeVenueId() {
    if (App.util?.makeId) return App.util.makeId("venue");
    return `venue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function cloneVenue(venue) {
    return venue ? { ...venue } : null;
  }

  function normalizeVenue(raw = {}) {
    const name = safeString(raw.name);
    const address = safeString(raw.address);
    const neighborhood = safeString(raw.neighborhood);
    const instagramUrl = safeString(raw.instagramUrl);
    const websiteUrl = safeString(raw.websiteUrl);
    const mapsUrl = safeString(raw.mapsUrl);
    const notes = safeString(raw.notes);

    const lat = toNumberOrNull(raw.lat);
    const lng = toNumberOrNull(raw.lng);

    return {
      id: safeString(raw.id) || makeVenueId(),
      name,
      address,
      neighborhood,
      lat,
      lng,
      instagramUrl,
      websiteUrl,
      mapsUrl,
      notes,
      createdAt: safeString(raw.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function validateVenue(raw = {}) {
    const name = safeString(raw.name);
    const lat = toNumberOrNull(raw.lat);
    const lng = toNumberOrNull(raw.lng);

    if (!name) {
      return { ok: false, error: "VENUE_NAME_REQUIRED" };
    }

    if (lat === null || lng === null) {
      return { ok: false, error: "VENUE_COORDS_REQUIRED" };
    }

    return { ok: true };
  }

  function findVenueIndexById(venueId) {
    ensureVenueState();
    return state.logic.venues.findIndex((v) => v.id === venueId);
  }

  function getAllVenuesInternal() {
    ensureVenueState();
    return state.logic.venues;
  }

  /* =========================
     READ
  ========================= */

  function listVenues() {
    return getAllVenuesInternal().map(cloneVenue);
  }

  function getVenueById(venueId) {
    if (!venueId) return null;
    const venue = getAllVenuesInternal().find((v) => v.id === venueId);
    return cloneVenue(venue);
  }

  function searchVenuesByName(query, limit = 8) {
    const q = safeLower(query);
    if (!q) return [];

    const venues = getAllVenuesInternal();

    return venues
      .map((venue) => {
        const name = safeLower(venue.name);
        const address = safeLower(venue.address);
        const neighborhood = safeLower(venue.neighborhood);

        let score = 0;

        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 60;
        else if (name.includes(q)) score += 40;

        if (address.includes(q)) score += 20;
        if (neighborhood.includes(q)) score += 10;

        return { venue, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.venue.name.localeCompare(b.venue.name))
      .slice(0, limit)
      .map((x) => cloneVenue(x.venue));
  }

  /* =========================
     WRITE
  ========================= */

  function addVenue(rawVenue = {}, options = {}) {
    ensureVenueState();

    const validation = validateVenue(rawVenue);
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.error
      };
    }

    const venue = normalizeVenue(rawVenue);

    const duplicate = state.logic.venues.find((v) => {
      const sameName = safeLower(v.name) === safeLower(venue.name);
      const sameLat = v.lat === venue.lat;
      const sameLng = v.lng === venue.lng;
      return sameName && sameLat && sameLng;
    });

    if (duplicate) {
      return {
        ok: false,
        error: "VENUE_DUPLICATE",
        venue: cloneVenue(duplicate)
      };
    }

    state.logic.venues.push(venue);

    if (options.persist) {
      App.storage?.saveVenues?.();
    }

    return {
      ok: true,
      venue: cloneVenue(venue)
    };
  }

  function updateVenue(venueId, patch = {}, options = {}) {
    ensureVenueState();

    const idx = findVenueIndexById(venueId);
    if (idx < 0) {
      return { ok: false, error: "VENUE_NOT_FOUND" };
    }

    const current = state.logic.venues[idx];
    const merged = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt
    };

    const validation = validateVenue(merged);
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.error
      };
    }

    const normalized = normalizeVenue(merged);
    normalized.id = current.id;
    normalized.createdAt = current.createdAt;
    normalized.updatedAt = new Date().toISOString();

    state.logic.venues[idx] = normalized;

    if (options.persist) {
      App.storage?.saveVenues?.();
    }

    return {
      ok: true,
      venue: cloneVenue(normalized)
    };
  }

  function removeVenue(venueId, options = {}) {
    ensureVenueState();

    const idx = findVenueIndexById(venueId);
    if (idx < 0) {
      return { ok: false, error: "VENUE_NOT_FOUND" };
    }

    const removed = state.logic.venues[idx];
    state.logic.venues.splice(idx, 1);

    if (options.persist) {
      App.storage?.saveVenues?.();
    }

    return {
      ok: true,
      venue: cloneVenue(removed)
    };
  }

  function replaceAllVenues(rawVenues = []) {
    ensureVenueState();

    const next = Array.isArray(rawVenues)
      ? rawVenues
          .map((raw) => normalizeVenue(raw))
          .filter((venue) => validateVenue(venue).ok)
      : [];

    state.logic.venues = next;

    return {
      ok: true,
      count: next.length
    };
  }

  /* =========================
     ADMIN UI SUPPORT
  ========================= */

  function selectVenueForAdmin(venueId) {
    ensureVenueUIState();

    const venue = getVenueById(venueId);
    if (!venue) {
      return { ok: false, error: "VENUE_NOT_FOUND" };
    }

    state.logic.selectedVenueId = venue.id;
    state.logic.adminVenueQuery = venue.name;
    state.logic.adminVenueSuggestions = [];

    return {
      ok: true,
      venue
    };
  }

  function clearSelectedVenueForAdmin() {
    ensureVenueUIState();

    state.logic.selectedVenueId = null;
    state.logic.adminVenueQuery = "";
    state.logic.adminVenueSuggestions = [];

    return { ok: true };
  }

  /* =========================
     PUBLIC API
  ========================= */

  App.venues = {
    listVenues,
    getVenueById,
    searchVenuesByName,
    addVenue,
    updateVenue,
    removeVenue,
    replaceAllVenues,
    selectVenueForAdmin,
    clearSelectedVenueForAdmin
  };
})();