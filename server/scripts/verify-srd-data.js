require("dotenv").config();
const mongoose = require("mongoose");
const SrdSpell = require("../src/models/srd-spell.model");
const SrdMonster = require("../src/models/srd-monster.model");

const isBlank = (field) => ({ $or: [{ [field]: "" }, { [field]: null }, { [field]: { $exists: false } }] });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const malformedText = /(?:\[object Object\]|^\{\s*name\s*:)/i;
  const [spellTotal, monsterTotal, monstersWithMalformedText, spellsWithoutComponents, samples] = await Promise.all([
    SrdSpell.countDocuments(),
    SrdMonster.countDocuments(),
    SrdMonster.find({ $or: [
      { size: malformedText }, { type: malformedText }, { alignment: malformedText },
      { languages: malformedText }, { challengeRating: malformedText },
    ] }, { name: 1, size: 1, type: 1, alignment: 1, languages: 1, challengeRating: 1 }).limit(10).lean(),
    SrdSpell.countDocuments(isBlank("components")),
    SrdMonster.find({}, { name: 1, size: 1, type: 1, alignment: 1, languages: 1, challengeRating: 1 }).sort({ name: 1 }).limit(5).lean(),
  ]);
  console.log(JSON.stringify({
    spellTotal,
    monsterTotal,
    malformedMonsterTextCount: monstersWithMalformedText.length,
    malformedMonsterText: monstersWithMalformedText,
    spellsWithoutComponents,
    monsterSamples: samples,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => { console.error("SRD verification failed:", error); await mongoose.disconnect(); process.exit(1); });
