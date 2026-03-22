// candidate-service.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});
  const { state } = App;

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeLooseText(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function simplifyVenueText(value = "") {
  return normalizeLooseText(value)
    .replace(/\b(teatro|sala|espacio|centro|cultural|club|bar|cafe|cafeteria|cafetería)\b/g, " ")
    .replace(/[()\-–—.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVenueNameCandidates(name = "") {
  const raw = String(name || "").trim();
  const short = App.util?.shortPlaceName ? App.util.shortPlaceName(raw) : raw;
  const simplifiedRaw = simplifyVenueText(raw);
  const simplifiedShort = simplifyVenueText(short);

  return [...new Set([
    raw,
    short,
    raw.replace(/\bteatro\b/gi, "").trim(),
    short.replace(/\bteatro\b/gi, "").trim(),
    simplifiedRaw,
    simplifiedShort
  ])]
    .map(normalizeLooseText)
    .filter(Boolean);
}

function tokenSet(value = "") {
  return new Set(
    simplifyVenueText(value)
      .split(" ")
      .map((x) => x.trim())
      .filter((x) => x.length >= 3)
  );
}

function tokenOverlapScore(a = "", b = "") {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);

  if (!aSet.size || !bSet.size) return 0;

  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }

  return intersection / Math.max(aSet.size, bSet.size);
}

 function findBestVenueMatch(candidate = {}) {
  const venues = Array.isArray(state.logic?.venues) ? state.logic.venues : [];
  if (!venues.length) return null;

  const candidateRawName = candidate.venueName || candidate.raw?.placeText || "";
  const candidateNames = buildVenueNameCandidates(candidateRawName);

  if (!candidateNames.length) return null;

  let best = null;

  for (const venue of venues) {
    const venueNameRaw = String(venue?.name || "").trim();
    const venueName = normalizeLooseText(venueNameRaw);
    const venueAddress = normalizeLooseText(venue?.address || "");

    if (!venueName) continue;
    if (!Number.isFinite(Number(venue?.lat)) || !Number.isFinite(Number(venue?.lng))) continue;

    let score = 0;

    for (const candName of candidateNames) {
      if (!candName) continue;

      if (venueName === candName) {
        score = Math.max(score, 100);
      } else if (venueName.startsWith(candName) || candName.startsWith(venueName)) {
        score = Math.max(score, 88);
      } else if (venueName.includes(candName) || candName.includes(venueName)) {
        score = Math.max(score, 75);
      }

      const overlap = tokenOverlapScore(candName, venueNameRaw);
      if (overlap >= 1) score = Math.max(score, 92);
      else if (overlap >= 0.75) score = Math.max(score, 84);
      else if (overlap >= 0.5) score = Math.max(score, 72);

      if (venueAddress) {
        const addressOverlap = tokenOverlapScore(candName, venueAddress);
        if (addressOverlap >= 0.75) score = Math.max(score, 60);
        else if (addressOverlap >= 0.5) score = Math.max(score, 48);
      }
    }

    if (!best || score > best.score) {
      best = { venue, score };
    }
  }

  if (!best || best.score < 72) return null;
  return best.venue;
}

  function enrichCandidateWithVenue(candidate = {}) {
    const alreadyHasCoords =
      Number.isFinite(candidate?.lat) && Number.isFinite(candidate?.lng);

    if (alreadyHasCoords) return candidate;

    const venue = findBestVenueMatch(candidate);
    if (!venue) return candidate;

    return {
      ...candidate,
      venueName: candidate.venueName || venue.name || "",
      lat: Number(venue.lat),
      lng: Number(venue.lng),
      enrichedByVenue: true,
      matchedVenueId: venue.id || null
    };
  }

  function mapDbRowToCandidate(row = {}) {
    const source = String(row.source_name || row.source || "unknown").trim() || "unknown";

    const rawCandidate = {
      id: String(row.id || "").trim() || undefined,
      source,
      sourceUrl: String(row.source_url || "").trim(),
      sourceId: String(row.external_id || row.source_id || "").trim(),

      title: String(row.parsed_title || row.raw_title || "").trim(),
      date: String(row.parsed_date || "").trim(),
      startTime: String(row.parsed_start_time || "").trim(),
      endTime: "",
      venueName: String(row.parsed_place_name || row.raw_place_text || "").trim(),
      address: "",
      lat: toNullableNumber(row.parsed_lat),
      lng: toNullableNumber(row.parsed_lng),
      category: String(row.parsed_category || "music").trim() || "music",

      status: String(row.status || "pending").trim() || "pending",

      raw: {
        title: String(row.raw_title || "").trim(),
        dateText: String(row.raw_date_text || "").trim(),
        timeText: String(row.raw_time_text || "").trim(),
        placeText: String(row.raw_place_text || "").trim(),
        link: String(row.raw_link || row.source_url || "").trim(),
        notes: String(row.notes || "").trim()
      }
    };

    const candidate = App.candidateDedupe?.ensureCandidateShape
      ? App.candidateDedupe.ensureCandidateShape(rawCandidate, source)
      : rawCandidate;

    const enriched = enrichCandidateWithVenue(candidate);

    return {
      ...enriched,
      dbRow: row,
      notes: String(row.notes || "").trim()
    };
  }

  function mapDbRowsToCandidates(rows = []) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.map(mapDbRowToCandidate);
  }

  function classifyCandidatesAgainstEvents(candidates = [], events = state.logic.events || []) {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    const safeEvents = Array.isArray(events) ? events : [];

    const linked = App.candidateDedupe?.linkCandidatesToExistingEvents
      ? App.candidateDedupe.linkCandidatesToExistingEvents(safeCandidates, safeEvents)
      : safeCandidates;

    return linked.map((candidate) => {
      const qualityFlags = Array.isArray(candidate.qualityFlags) ? [...candidate.qualityFlags] : [];
      let suggestedAction = candidate.suggestedAction || "create";

      if (!candidate.venueName) {
        if (!qualityFlags.includes("missing_venue")) qualityFlags.push("missing_venue");
      }

      if (candidate.lat == null || candidate.lng == null) {
        if (!qualityFlags.includes("missing_coords")) qualityFlags.push("missing_coords");
      }

      if ((candidate.qualityScore || 0) < 60 && suggestedAction === "create") {
        suggestedAction = "review";
      }

      return {
        ...candidate,
        qualityFlags,
        suggestedAction
      };
    });
  }

  function sortCandidatesForReview(candidates = []) {
    const safe = Array.isArray(candidates) ? [...candidates] : [];

    const actionRank = (candidate) => {
      switch (candidate?.suggestedAction) {
        case "reject_duplicate":
          return 0;
        case "link_existing_event":
          return 1;
        case "create":
          return 2;
        case "review":
          return 3;
        default:
          return 4;
      }
    };

    return safe.sort((a, b) => {
      const actionDiff = actionRank(a) - actionRank(b);
      if (actionDiff !== 0) return actionDiff;

      const qualityDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
      if (qualityDiff !== 0) return qualityDiff;

      const dateA = String(a.date || "");
      const dateB = String(b.date || "");
      const dateDiff = dateA.localeCompare(dateB);
      if (dateDiff !== 0) return dateDiff;

      const timeA = String(a.startTime || "99:99");
      const timeB = String(b.startTime || "99:99");
      const timeDiff = timeA.localeCompare(timeB);
      if (timeDiff !== 0) return timeDiff;

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  function hydrateCandidatesToState(candidates = []) {
    const safe = Array.isArray(candidates) ? candidates : [];

    App.store?.dispatch?.({
      type: "SET_CANDIDATES",
      candidates: safe
    });

    return state.logic.candidates || [];
  }

  async function loadPendingCandidatesBySource(sourceName = "") {
    const source = String(sourceName || "").trim();
    if (!source) {
      return { ok: false, error: "MISSING_SOURCE_NAME", candidates: [] };
    }

    const pending = await App.storage?.loadPendingEventCandidatesBySource?.(source);

    if (!pending?.ok) {
      return {
        ok: false,
        error: pending?.error || "LOAD_PENDING_FAILED",
        candidates: []
      };
    }

    const mapped = mapDbRowsToCandidates(pending.candidates || []);
    const classified = classifyCandidatesAgainstEvents(mapped, state.logic.events || []);
    const sorted = sortCandidatesForReview(classified);

    hydrateCandidatesToState(sorted);

    return {
      ok: true,
      source,
      candidates: sorted
    };
  }

  async function persistEnrichedCandidates(candidateIds = []) {
  const ids = Array.isArray(candidateIds)
    ? candidateIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!ids.length) {
    return { ok: true, updatedCount: 0 };
  }

  const currentCandidates = Array.isArray(state.logic.candidates) ? state.logic.candidates : [];
  let updatedCount = 0;

  for (const id of ids) {
    const candidate = currentCandidates.find((c) => String(c?.id || "").trim() === id);
    if (!candidate) continue;
    if (!candidate.enrichedByVenue) continue;
    if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) continue;

    const result = await App.storage?.updateEventCandidateParsedData?.(id, {
      parsed_lat: candidate.lat,
      parsed_lng: candidate.lng,
      parsed_place_name: candidate.venueName || ""
    });

    if (result?.ok) {
      updatedCount += 1;
    }
  }

  return {
    ok: true,
    updatedCount
  };
}

 async function approveCandidates(candidateIds = []) {
  const ids = Array.isArray(candidateIds)
    ? candidateIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!ids.length) {
    return { ok: false, error: "EMPTY_CANDIDATE_IDS" };
  }

  await persistEnrichedCandidates(ids);

  const result = await App.storage?.approveEventCandidatesBulk?.(ids);

  if (!result?.ok) {
    return { ok: false, error: result?.error || "APPROVE_FAILED" };
  }

  const loadedEvents = await App.storage?.loadEvents?.();
  if (loadedEvents?.ok) {
    App.events?.setAllEvents?.(loadedEvents.events || []);
  }

  return {
    ok: true,
    approvedCount: result.approvedCount || 0
  };
}

  App.candidates = {
    ...(App.candidates || {}),
    mapDbRowToCandidate,
    mapDbRowsToCandidates,
    classifyCandidatesAgainstEvents,
    sortCandidatesForReview,
    hydrateCandidatesToState,
    loadPendingCandidatesBySource,
    approveCandidates,
        persistEnrichedCandidates,
    findBestVenueMatch,
    enrichCandidateWithVenue
  };
})();