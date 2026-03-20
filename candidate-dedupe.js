// candidate-dedupe.js
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  function normalizeText(str = "") {
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[“”"'`´]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTitle(title = "") {
    return normalizeText(title)
      .replace(/\s*[-|–—]\s*(teatro|funcion|función|entradas|entrada|localidades).*$/i, "")
      .trim();
  }

  function normalizeVenueName(name = "") {
    return normalizeText(name)
      .replace(/\bteatro\b/g, "")
      .replace(/\bcentro cultural\b/g, "cc")
      .replace(/\bsala\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildFingerprint(c) {
    return [
      normalizeTitle(c.title),
      c.date || "",
      normalizeVenueName(c.venueName || c.place || ""),
      c.startTime || ""
    ].join("|");
  }

  function computeCandidateQuality(c) {
    const flags = [];
    let score = 0;

    if (c.title) score += 25;
    else flags.push("missing_title");

    if (c.date) score += 25;
    else flags.push("missing_date");

    if (c.startTime) score += 10;
    else flags.push("missing_start_time");

    if (c.venueName) score += 20;
    else flags.push("missing_venue");

    if (c.lat != null && c.lng != null) score += 20;
    else flags.push("missing_coords");

    if ((c.titleNorm || "").length < 4) flags.push("weak_title");

    return { flags, score };
  }

  function similarity(a = "", b = "") {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const aWords = new Set(a.split(" ").filter(Boolean));
    const bWords = new Set(b.split(" ").filter(Boolean));

    const intersection = [...aWords].filter((x) => bWords.has(x)).length;
    const union = new Set([...aWords, ...bWords]).size;

    return union ? intersection / union : 0;
  }

  function sameCoordsApprox(a, b, precision = 3) {
    if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return false;

    return (
      Number(a.lat).toFixed(precision) === Number(b.lat).toFixed(precision) &&
      Number(a.lng).toFixed(precision) === Number(b.lng).toFixed(precision)
    );
  }

  function compareCandidates(a, b) {
    const sameFingerprint = a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint;
    const sameDate = a.date && b.date && a.date === b.date;
    const sameTime = (a.startTime || "") === (b.startTime || "");
    const titleScore = similarity(a.titleNorm || "", b.titleNorm || "");
    const venueScore = similarity(a.venueNorm || "", b.venueNorm || "");
    const samePlace = venueScore > 0.85 || sameCoordsApprox(a, b);

    if (sameFingerprint) {
      return { isDuplicate: true, level: "exact", score: 1 };
    }

    if (sameDate && sameTime && titleScore > 0.85 && samePlace) {
      return { isDuplicate: true, level: "probable", score: 0.93 };
    }

    if (sameDate && titleScore > 0.9 && venueScore > 0.65) {
      return { isDuplicate: true, level: "possible", score: 0.82 };
    }

    return { isDuplicate: false, level: "none", score: 0 };
  }

  function pickBetterValue(a, b) {
    if (!a && b) return b;
    if (a && !b) return a;
    return a || b;
  }

  function mergeSourceLists(existingSources = [], nextSource) {
    const set = new Set(existingSources);
    if (nextSource) set.add(nextSource);
    return [...set];
  }

  function mergeCandidateData(base, incoming) {
    return {
      ...base,
      title: pickBetterValue(base.title, incoming.title),
      date: pickBetterValue(base.date, incoming.date),
      startTime: pickBetterValue(base.startTime, incoming.startTime),
      endTime: pickBetterValue(base.endTime, incoming.endTime),
      venueName: pickBetterValue(base.venueName, incoming.venueName),
      address: pickBetterValue(base.address, incoming.address),
      lat: base.lat ?? incoming.lat,
      lng: base.lng ?? incoming.lng,
      category: pickBetterValue(base.category, incoming.category),

      source: base.source,
      sourceUrl: pickBetterValue(base.sourceUrl, incoming.sourceUrl),
      sourceId: pickBetterValue(base.sourceId, incoming.sourceId),

      sources: mergeSourceLists(base.sources || [base.source], incoming.source),
      sourceUrls: [
        ...new Set([
          ...(base.sourceUrls || []).filter(Boolean),
          ...(base.sourceUrl ? [base.sourceUrl] : []),
          ...(incoming.sourceUrl ? [incoming.sourceUrl] : [])
        ])
      ],
      mergedFromCandidateIds: [
        ...new Set([
          ...(base.mergedFromCandidateIds || [base.id]),
          incoming.id
        ])
      ]
    };
  }

  function ensureCandidateShape(raw = {}, source = "unknown") {
    const id =
      raw.id ||
      raw.candidateId ||
      `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const candidate = {
      id,
      source,
      sourceUrl: raw.sourceUrl || raw.url || "",
      sourceId: raw.sourceId || "",

      title: raw.title || "",
      date: raw.date || "",
      startTime: raw.startTime || "",
      endTime: raw.endTime || "",
      venueName: raw.venueName || raw.place || "",
      address: raw.address || "",
      lat: Number.isFinite(raw.lat) ? raw.lat : null,
      lng: Number.isFinite(raw.lng) ? raw.lng : null,
      category: raw.category || "music",

      raw,
      status: raw.status || "pending",
      duplicateStatus: "none",
      duplicateOfEventId: null,
      duplicateOfCandidateId: null,
      suggestedAction: "create"
    };

    candidate.titleNorm = normalizeTitle(candidate.title);
    candidate.venueNorm = normalizeVenueName(candidate.venueName);
    candidate.fingerprint = buildFingerprint(candidate);

    const quality = computeCandidateQuality(candidate);
    candidate.qualityFlags = quality.flags;
    candidate.qualityScore = quality.score;

    return candidate;
  }

  function mergeRawCandidates(rawCandidates = []) {
    const result = [];

    for (const current of rawCandidates) {
      const match = result.find((existing) => compareCandidates(existing, current).isDuplicate);

      if (!match) {
        result.push({
          ...current,
          sources: [current.source],
          sourceUrls: current.sourceUrl ? [current.sourceUrl] : [],
          mergedFromCandidateIds: [current.id]
        });
        continue;
      }

      const merged = mergeCandidateData(match, current);
      merged.titleNorm = normalizeTitle(merged.title);
      merged.venueNorm = normalizeVenueName(merged.venueName);
      merged.fingerprint = buildFingerprint(merged);

      const quality = computeCandidateQuality(merged);
      merged.qualityFlags = quality.flags;
      merged.qualityScore = quality.score;

      const idx = result.findIndex((x) => x.id === match.id);
      result[idx] = merged;
    }

    return result;
  }

  function eventToComparableShape(ev) {
    return {
      id: ev.id,
      title: ev.title || "",
      date: ev.date || "",
      startTime: ev.startTime || "",
      venueName: ev.place || ev.venueName || "",
      lat: ev.lat ?? null,
      lng: ev.lng ?? null,
      titleNorm: normalizeTitle(ev.title || ""),
      venueNorm: normalizeVenueName(ev.place || ev.venueName || ""),
      fingerprint: [
        normalizeTitle(ev.title || ""),
        ev.date || "",
        normalizeVenueName(ev.place || ev.venueName || ""),
        ev.startTime || ""
      ].join("|")
    };
  }

  function linkCandidatesToExistingEvents(candidates = [], events = []) {
    const comparableEvents = events.map(eventToComparableShape);

    return candidates.map((candidate) => {
      let bestMatch = null;

      for (const ev of comparableEvents) {
        const cmp = compareCandidates(candidate, ev);
        if (!cmp.isDuplicate) continue;

        if (!bestMatch || cmp.score > bestMatch.score) {
          bestMatch = { eventId: ev.id, ...cmp };
        }
      }

      if (!bestMatch) return candidate;

      return {
        ...candidate,
        duplicateStatus: bestMatch.level,
        duplicateOfEventId: bestMatch.eventId,
        suggestedAction:
          bestMatch.level === "exact" ? "reject_duplicate" : "link_existing_event"
      };
    });
  }

  function mergeIntoExistingCandidates(existing = [], incoming = []) {
    const out = [...existing];

    for (const candidate of incoming) {
      const idx = out.findIndex((x) =>
        (x.fingerprint && x.fingerprint === candidate.fingerprint) ||
        (x.sourceUrl && candidate.sourceUrl && x.sourceUrl === candidate.sourceUrl)
      );

      if (idx === -1) {
        out.push(candidate);
        continue;
      }

      const merged = mergeCandidateData(out[idx], candidate);
      merged.titleNorm = normalizeTitle(merged.title);
      merged.venueNorm = normalizeVenueName(merged.venueName);
      merged.fingerprint = buildFingerprint(merged);

      const quality = computeCandidateQuality(merged);
      merged.qualityFlags = quality.flags;
      merged.qualityScore = quality.score;

      out[idx] = merged;
    }

    return out;
  }

  App.candidateDedupe = {
    normalizeText,
    normalizeTitle,
    normalizeVenueName,
    buildFingerprint,
    computeCandidateQuality,
    compareCandidates,
    ensureCandidateShape,
    mergeCandidateData,
    mergeRawCandidates,
    linkCandidatesToExistingEvents,
    mergeIntoExistingCandidates
  };
})();