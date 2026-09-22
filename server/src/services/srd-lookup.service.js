const SrdSpell = require("../models/srd-spell.model");
const SrdMonster = require("../models/srd-monster.model");

const MAX_MATCHES_PER_TURN = 3;
const MAX_DESCRIPTION_CHARS = 500;
const ATTRIBUTION_NOTICE = "This work includes material from the System Reference Document 5.2 (SRD 5.2) by Wizards of the Coast LLC, available at dndbeyond.com/srd, licensed under CC-BY-4.0.";

let nameIndex = new Map();
let sortedNames = [];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const truncate = (value, max = MAX_DESCRIPTION_CHARS) => {
  const text = typeof value === "string" ? value : "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

async function buildIndex() {
  const [spells, monsters] = await Promise.all([
    SrdSpell.find({}, { nameLower: 1 }).lean(),
    SrdMonster.find({}, { nameLower: 1 }).lean(),
  ]);
  nameIndex = new Map();
  for (const spell of spells) nameIndex.set(spell.nameLower, [...(nameIndex.get(spell.nameLower) || []), "spell"]);
  for (const monster of monsters) nameIndex.set(monster.nameLower, [...(nameIndex.get(monster.nameLower) || []), "monster"]);
  sortedNames = [...nameIndex.keys()].sort((left, right) => right.length - left.length);
  console.log(`[srd-lookup] index built: ${spells.length} spells, ${monsters.length} monsters`);
}

async function initSrdLookup() { await buildIndex(); }
async function refreshSrdIndex() { await buildIndex(); }

function scanForNames(text) {
  const input = text.toLowerCase();
  const matches = [];
  const claimed = [];
  for (const nameLower of sortedNames) {
    if (matches.length >= MAX_MATCHES_PER_TURN) break;
    const match = new RegExp(`\\b${escapeRegExp(nameLower)}\\b`, "i").exec(input);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (claimed.some(([from, to]) => start < to && end > from)) continue;
    claimed.push([start, end]);
    matches.push({ nameLower, types: nameIndex.get(nameLower), start });
  }
  return matches.sort((left, right) => left.start - right.start);
}

function formatSpell(doc) {
  const details = [
    `[SPELL] ${doc.name}`,
    `Level ${doc.level ?? "?"} ${doc.school || ""}`.trim(),
    doc.castingTime && `Casting Time: ${doc.castingTime}`,
    doc.range && `Range: ${doc.range}`,
    doc.duration && `Duration: ${doc.duration}${doc.concentration ? " (Concentration)" : ""}`,
    doc.components && `Components: ${doc.components}`,
  ].filter(Boolean).join(" | ");
  return `${details}\n${truncate(doc.description)}`;
}

function formatMonster(doc) {
  const score = doc.abilityScores || {};
  const abilityLine = `STR ${score.str ?? "-"} DEX ${score.dex ?? "-"} CON ${score.con ?? "-"} INT ${score.int ?? "-"} WIS ${score.wis ?? "-"} CHA ${score.cha ?? "-"}`;
  const actions = (doc.actions || []).map((action) => `${action.name}: ${truncate(action.description, 150)}`).join(" / ");
  return [
    `[MONSTER] ${doc.name} — ${doc.size || ""} ${doc.type || ""}, CR ${doc.challengeRating || "?"}`.trim(),
    `AC ${JSON.stringify(doc.armorClass ?? "?")} | HP ${doc.hitPoints ?? "?"} (${doc.hitDice || "-"}) | Speed ${JSON.stringify(doc.speed ?? "?")}`,
    abilityLine,
    actions && `Actions: ${actions}`,
  ].filter(Boolean).join("\n");
}

async function findMentionedEntities(text) {
  if (!text?.trim() || !sortedNames.length) return null;
  const blocks = [];
  for (const match of scanForNames(text)) {
    if (match.types.includes("spell")) {
      const spell = await SrdSpell.findOne({ nameLower: match.nameLower }).lean();
      if (spell) blocks.push(formatSpell(spell));
    }
    if (match.types.includes("monster") && blocks.length < MAX_MATCHES_PER_TURN) {
      const monster = await SrdMonster.findOne({ nameLower: match.nameLower }).lean();
      if (monster) blocks.push(formatMonster(monster));
    }
  }
  if (!blocks.length) return null;
  return `ข้อมูลอ้างอิง SRD 5.2 ที่เกี่ยวข้องกับข้อความผู้เล่น:\n\n${blocks.join("\n\n")}\n\n[ใช้เพื่อความแม่นยำของกฎ แต่กฎทองคำและ player agency ใน system prompt หลักมีลำดับความสำคัญเหนือกว่า]`;
}

module.exports = { initSrdLookup, refreshSrdIndex, findMentionedEntities, ATTRIBUTION_NOTICE };
