const mongoose = require("mongoose");

const abilitySchema = new mongoose.Schema(
  {
    strength: { type: Number, default: 10, min: 1, max: 30 },
    dexterity: { type: Number, default: 10, min: 1, max: 30 },
    constitution: { type: Number, default: 10, min: 1, max: 30 },
    intelligence: { type: Number, default: 10, min: 1, max: 30 },
    wisdom: { type: Number, default: 10, min: 1, max: 30 },
    charisma: { type: Number, default: 10, min: 1, max: 30 },
  },
  { _id: false }
);

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    weight: { type: Number, default: 0, min: 0 },
    equipped: { type: Boolean, default: false },
  },
  { _id: true }
);

const characterSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    race: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    background: { type: String, trim: true },
    alignment: { type: String, trim: true },
    level: { type: Number, default: 1, min: 1, max: 20 },
    abilities: { type: abilitySchema, default: () => ({}) },
    hitPoints: {
      current: { type: Number, default: 10, min: 0 },
      maximum: { type: Number, default: 10, min: 1 },
      temporary: { type: Number, default: 0, min: 0 },
    },
    armorClass: { type: Number, default: 10, min: 0 },
    proficiencyBonus: { type: Number, default: 2, min: 0 },
    inventory: { type: [inventoryItemSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 5000 },
    sheet: {
      fileName: { type: String },
      mimeType: { type: String },
      summary: { type: String, maxlength: 12000 },
      uploadedAt: { type: Date },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

characterSchema.index({ campaign: 1, name: 1 }, { unique: true });
characterSchema.index({ player: 1, campaign: 1 });

module.exports = mongoose.model("Character", characterSchema);
