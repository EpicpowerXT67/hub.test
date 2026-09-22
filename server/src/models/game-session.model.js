const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    character: { type: mongoose.Schema.Types.ObjectId, ref: "Character", required: true },
    initiative: { type: Number, default: 0 },
    isPresent: { type: Boolean, default: true },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    sessionNumber: { type: Number, required: true, min: 1 },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    status: {
      type: String,
      enum: ["planned", "in-progress", "completed", "cancelled"],
      default: "planned",
    },
    participants: { type: [participantSchema], default: [] },
    summary: { type: String, trim: true, maxlength: 5000 },
    dmNotes: { type: String, trim: true, maxlength: 10000 },
  },
  { timestamps: true }
);

gameSessionSchema.index({ campaign: 1, sessionNumber: 1 }, { unique: true });
gameSessionSchema.index({ campaign: 1, scheduledAt: 1 });

module.exports = mongoose.model("GameSession", gameSessionSchema);