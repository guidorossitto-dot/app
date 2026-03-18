import crypto from "node:crypto";
import * as cheerio from "cheerio";

const SOURCE_NAME = "zibilia";
const LISTING_URL = "https://www.zibilia.com/";
const MAX_DETAIL_PAGES = 10;

/* =========================
   HELPERS BÁSICOS
========================= */
function makeId() {
  return crypto.randomUUID();
}

function normalizeText(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function firstTimeFromRaw(raw = "") {
  const m = String(raw).match(/\b(\d{1,2}:\d{2})\b/);
  return m ? m[1] : null;
}

function makeExternalId(detailUrl, placeText = "") {
  return `${detailUrl}::${normalizeText(placeText).toLowerCase()}`;
}

/* =========================
   FETCH
========================= */
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "accept-language": "es-AR,es;q=0.9,en;q=0.8"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al pedir ${url}`);
  }

  return await res.text();
}

/* =========================
   LISTADO
========================= */
function looksLikeZibiliaDetailUrl(url) {
  if (!url.startsWith("https://www.zibilia.com/")) return false;
  if (url === LISTING_URL) return false;

  // Evitar cosas claramente no-evento
  const blocked = [
    "/signup",
    "/sessions",
    "/password_resets",
    "/auth/",
    "/about",
    "/contact",
    "/users/",
    "/revista",
    "/protagonistas",
    "/lugares",
    "/favoritos"
  ];

  if (blocked.some((part) => url.includes(part))) return false;

  // Zibilia suele usar URLs con "=" para eventos puntuales
  if (url.includes("/=")) return true;

  return false;
}

async function extractDetailLinks(listingUrl) {
  const html = await fetchHtml(listingUrl);
  const $ = cheerio.load(html);

  const urls = new Set();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let absolute = "";
    try {
      absolute = new URL(href, listingUrl).toString();
    } catch {
      return;
    }

    // Normalizar anchors
    absolute = absolute.split("#")[0];

    if (looksLikeZibiliaDetailUrl(absolute)) {
      urls.add(absolute);
    }
  });

  return [...urls];
}

/* =========================
   JSON-LD
========================= */
function extractJsonLdObjects($) {
  const out = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    const parsed = safeJsonParse(raw);

    if (!parsed) return;

    if (Array.isArray(parsed)) {
      out.push(...parsed);
    } else {
      out.push(parsed);
    }
  });

  return out;
}

function buildObjectMap(jsonLdObjects = []) {
  const map = new Map();

  for (const obj of jsonLdObjects) {
    const id = String(obj?.["@id"] || "").trim();
    if (id) map.set(id, obj);
  }

  return map;
}

function pickMainEvent(jsonLdObjects = []) {
  return (
    jsonLdObjects.find((obj) => {
      const type = String(obj?.["@type"] || "").toLowerCase();
      return type.includes("event");
    }) || null
  );
}

function resolveLocations(mainEvent, objectMap) {
  const locs = Array.isArray(mainEvent?.location) ? mainEvent.location : [];
  const resolved = [];

  for (const locRef of locs) {
    const refId = String(locRef?.["@id"] || "").trim();
    if (!refId) continue;

    const venue = objectMap.get(refId);
    if (venue) resolved.push(venue);
  }

  return resolved;
}

function mapSchemaTypeToCategory(schemaType = "") {
  const t = String(schemaType || "").toLowerCase();

  if (t.includes("theaterevent")) return "theatre";
  if (t.includes("musicevent")) return "music";
  if (t.includes("danceevent")) return "dance";
  if (t.includes("movie") || t.includes("screeningevent")) return "cinema";

  return "";
}

/* =========================
   HTML AUXILIAR
========================= */
function extractFirstTimeFromHtml($) {
  const bodyText = $.root().text();
  const m = bodyText.match(/\b(\d{1,2}:\d{2})\b/);
  return m ? m[1] : "";
}

function extractRecurrenceNote($) {
  const bodyText = $.root().text();

  const patterns = [
    /Todos\s+los\s+d[ií]as/i,
    /Los\s+Lunes/i,
    /Los\s+Martes/i,
    /Los\s+Mi[eé]rcoles/i,
    /Los\s+Jueves/i,
    /Los\s+Viernes/i,
    /Los\s+S[áa]bados/i,
    /Los\s+Domingos/i
  ];

  for (const re of patterns) {
    const m = bodyText.match(re);
    if (m) return m[0];
  }

  return "";
}

function extractTitleFallback($) {
  const titleTag = normalizeText($("title").first().text());
  if (titleTag) return titleTag;

  const h1 = normalizeText($("h1").first().text());
  return h1;
}

/* =========================
   DETALLE
========================= */
async function parseDetailPage(detailUrl) {
  const html = await fetchHtml(detailUrl);
  const $ = cheerio.load(html);

  const jsonLdObjects = extractJsonLdObjects($);
  const objectMap = buildObjectMap(jsonLdObjects);
  const mainEvent = pickMainEvent(jsonLdObjects);

  if (!mainEvent) {
    return [];
  }

  const title =
    normalizeText(mainEvent?.name) ||
    extractTitleFallback($);

  const parsedDate = normalizeText(mainEvent?.startDate || "") || null;
  const schemaType = String(mainEvent?.["@type"] || "");
  const parsedCategory = mapSchemaTypeToCategory(schemaType);

  const recurrenceNote = extractRecurrenceNote($);
  const fallbackTime = extractFirstTimeFromHtml($);

  const eventUrl = normalizeText(mainEvent?.url || detailUrl) || detailUrl;
  const description = normalizeText(mainEvent?.description || "");

  const locations = resolveLocations(mainEvent, objectMap);

  // Si no hay locations estructuradas, devolvemos un candidato igual
  if (!locations.length) {
    return [
      {
        id: makeId(),
        source_name: SOURCE_NAME,
        source_url: detailUrl,
        external_id: makeExternalId(detailUrl, ""),

        raw_title: title,
        raw_date_text: parsedDate || "",
        raw_time_text: fallbackTime || recurrenceNote || "",
        raw_place_text: "",
        raw_link: eventUrl,

        parsed_title: title,
        parsed_date: parsedDate,
        parsed_start_time: firstTimeFromRaw(fallbackTime) || null,
        parsed_place_name: "",
        parsed_category: parsedCategory,
        parsed_lat: null,
        parsed_lng: null,

        status: "pending",
        notes: recurrenceNote
          ? `Recurrencia detectada: ${recurrenceNote}`
          : description
      }
    ];
  }

  return locations.map((venue) => {
    const placeName = normalizeText(venue?.name || "");
    const address = normalizeText(venue?.address || "");
    const placeText = [placeName, address].filter(Boolean).join(" - ");

    const lat = Number(venue?.geo?.latitude);
    const lng = Number(venue?.geo?.longitude);

    return {
      id: makeId(),
      source_name: SOURCE_NAME,
      source_url: detailUrl,
      external_id: makeExternalId(detailUrl, placeName || address),

      raw_title: title,
      raw_date_text: parsedDate || "",
      raw_time_text: fallbackTime || recurrenceNote || "",
      raw_place_text: placeText,
      raw_link: eventUrl,

      parsed_title: title,
      parsed_date: parsedDate,
      parsed_start_time: firstTimeFromRaw(fallbackTime) || null,
      parsed_place_name: placeName,
      parsed_category: parsedCategory,
      parsed_lat: Number.isFinite(lat) ? lat : null,
      parsed_lng: Number.isFinite(lng) ? lng : null,

      status: "pending",
      notes: recurrenceNote
        ? `Recurrencia detectada: ${recurrenceNote}`
        : description
    };
  });
}

/* =========================
   DEDUP SIMPLE EN MEMORIA
========================= */
function dedupeCandidates(candidates = []) {
  const seen = new Set();
  const out = [];

  for (const c of candidates) {
    const key = [
      normalizeText(c.external_id),
      normalizeText(c.parsed_title),
      normalizeText(c.parsed_date),
      normalizeText(c.parsed_place_name)
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }

  return out;
}

/* =========================
   RUN
========================= */
async function run() {
  console.log("Buscando links en:", LISTING_URL);

  const detailLinks = await extractDetailLinks(LISTING_URL);
  console.log(`Links candidatos encontrados: ${detailLinks.length}`);

  if (!detailLinks.length) {
    console.log("No se encontraron links de detalle.");
    return;
  }

  const collected = [];

  for (const url of detailLinks.slice(0, MAX_DETAIL_PAGES)) {
    try {
      console.log("Parseando:", url);
      const candidates = await parseDetailPage(url);
      collected.push(...candidates);
    } catch (err) {
      console.error("Error parseando detalle:", url, err.message);
    }
  }

  const unique = dedupeCandidates(collected);

  console.log(`Candidatos generados: ${collected.length}`);
  console.log(`Candidatos únicos: ${unique.length}`);
  console.log("Primeros candidatos:");
  console.dir(unique.slice(0, 10), { depth: null });
}

run().catch((err) => {
  console.error("Error general:", err);
});