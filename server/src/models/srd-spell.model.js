const mongoose = require("mongoose");

const srdSpellSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  nameLower: { type: String, required: true, unique: true, index: true },
  level: Number,
  school: String,
  castingTime: String,
  range: String,
  components: String,
  duration: String,
  concentration: Boolean,
  ritual: Boolean,
  description: String,
  higherLevel: String,
  sourceKey: { type: String, default: "srd-2024", index: true },
  raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model("SrdSpell", srdSpellSchema);
