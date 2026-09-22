require("dotenv").config();
const mongoose = require("mongoose");
const SrdSpell = require("../src/models/srd-spell.model");
const SrdMonster = require("../src/models/srd-monster.model");

const BASE_URL = "https://api.open5e.com/v2";
const SOURCE_FILTER = "srd-2024";
const PAGE_LIMIT = 50;
const MAX_FETCH_ATTEMPTS = 5;
const FETCH_TIMEOUT_MS = 30000;
const scalar = (value) => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(", ");
  if (typeof value === "object") return String(value.name ?? value.key ?? value.value ?? "");
  return String(value);
};
const text = (value) => Array.isArray(value) ? value.map(scalar).filter(Boolean).join("\n") : scalar(value);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "PortAbleTrack-SRD-Sync/1.0" },
      });
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) throw new Error(`Open5e API error ${response.status} at ${url}`);
      lastError = new Error(`Open5e API error ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_FETCH_ATTEMPTS) break;
    }

    if (attempt < MAX_FETCH_ATTEMPTS) {
      const delayMs = Math.min(1000 * (2 ** (attempt - 1)), 15000);
      console.warn(`Open5e request failed (attempt ${attempt}/${MAX_FETCH_ATTEMPTS}): ${lastError.message}. Retrying in ${delayMs / 1000}s...`);
      await wait(delayMs);
    }
  }
  throw lastError;
}

async function fetchAllPages(endpoint) {
  let url = `${BASE_URL}/${endpoint}/?document__key__in=${SOURCE_FILTER}&limit=${PAGE_LIMIT}`;
  const results = [];
  while (url) {
    const response = await fetchWithRetry(url);
    const page = await response.json();
    results.push(...(page.results || []));
    url = page.next || null;
    if (url) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return results;
}

const mapSpell = (item) => ({
  name: item.name,
  nameLower: item.name.trim().toLowerCase(),
  level: item.level ?? null,
  school: scalar(item.school),
  castingTime: item.casting_time || "",
  range: item.range_text || scalar(item.range),
  components: [[item.verbal && "V"], [item.somatic && "S"], [item.material && `M${item.material_specified ? ` (${item.material_specified})` : ""}`]].flat().filter(Boolean).join(", "),
  duration: item.duration || "",
  concentration: Boolean(item.concentration),
  ritual: Boolean(item.ritual),
  description: text(item.desc || item.description),
  higherLevel: text(item.higher_level),
  sourceKey: item.document?.key || SOURCE_FILTER,
  raw: item,
});

const mapAction = (item) => ({ name: item.name || "", description: text(item.desc || item.description) });
const mapMonster = (item) => {
  const scores = item.ability_scores || {};
  return {
    name: item.name,
    nameLower: item.name.trim().toLowerCase(),
    size: scalar(item.size), type: scalar(item.type), alignment: scalar(item.alignment),
    armorClass: item.armor_class ?? null, hitPoints: item.hit_points ?? null, hitDice: scalar(item.hit_dice),
    speed: item.speed_all || item.speed || "", challengeRating: scalar(item.challenge_rating),
    abilityScores: { str: scores.strength ?? scores.str, dex: scores.dexterity ?? scores.dex, con: scores.constitution ?? scores.con, int: scores.intelligence ?? scores.int, wis: scores.wisdom ?? scores.wis, cha: scores.charisma ?? scores.cha },
    languages: scalar(item.languages), actions: (item.actions || []).map(mapAction), traits: (item.traits || []).map(mapAction),
    sourceKey: item.document?.key || SOURCE_FILTER, raw: item,
  };
};

async function upsertAll(Model, items, map) {
  for (const item of items) {
    const doc = map(item);
    await Model.updateOne({ nameLower: doc.nameLower }, { $set: doc }, { upsert: true });
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  const [spells, monsters] = await Promise.all([fetchAllPages("spells"), fetchAllPages("creatures")]);
  console.log(`Fetched ${spells.length} spells and ${monsters.length} creatures. Caching...`);
  await upsertAll(SrdSpell, spells, mapSpell);
  await upsertAll(SrdMonster, monsters, mapMonster);
  await mongoose.disconnect();
  console.log("Done. SRD 2024 data cached locally.");
}

main().catch(async (error) => { console.error("SRD sync failed:", error); await mongoose.disconnect(); process.exit(1); });
