const mongoose = require("mongoose");

const srdMonsterSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  nameLower: { type: String, required: true, unique: true, index: true },
  size: String,
  type: String,
  alignment: String,
  armorClass: mongoose.Schema.Types.Mixed,
  hitPoints: Number,
  hitDice: String,
  speed: mongoose.Schema.Types.Mixed,
  challengeRating: String,
  abilityScores: { str: Number, dex: Number, con: Number, int: Number, wis: Number, cha: Number },
  languages: mongoose.Schema.Types.Mixed,
  actions: [{ name: String, description: String }],
  traits: [{ name: String, description: String }],
  sourceKey: { type: String, default: "srd-2024", index: true },
  raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model("SrdMonster", srdMonsterSchema);
