const mongoose = require("mongoose");

const combatantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["character", "monster", "npc"], required: true },
    character: { type: mongoose.Schema.Types.ObjectId, ref: "Character" },
    armorClass: { type: Number, default: 10, min: 0 },
    hitPoints: { type: Number, default: 1, min: 0 },
    maxHitPoints: { type: Number, default: 1, min: 1 },
    initiative: { type: Number, default: 0 },
    isDefeated: { type: Boolean, default: false },
  },
  { _id: true }
);

const encounterSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "GameSession", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ["draft", "active", "completed"], default: "draft" },
    round: { type: Number, default: 0, min: 0 },
    currentTurn: { type: Number, default: 0, min: 0 },
    combatants: { type: [combatantSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

encounterSchema.index({ session: 1, createdAt: -1 });

module.exports = mongoose.model("Encounter", encounterSchema);