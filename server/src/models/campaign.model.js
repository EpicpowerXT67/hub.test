const mongoose = require("mongoose");

const campaignMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    role: { type: String, enum: ["dm", "player"], default: "player" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 5000 },
    storyOutline: { type: String, trim: true, maxlength: 30000, default: "" },
    campaignState: { type: String, trim: true, maxlength: 30000, default: "" },
    context: {
      persistentState: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({ characters: {}, activeQuests: [], keyNpcs: {}, location: "" }),
      },
      rollingSummary: { type: String, trim: true, maxlength: 30000, default: "" },
      pendingSrdReference: { type: String, trim: true, maxlength: 6000, default: "" },
      summarizedMessageCount: { type: Number, default: 0, min: 0 },
      lastPromptTokens: { type: Number, default: 0, min: 0 },
      lastContextRatio: { type: Number, default: 0, min: 0 },
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    members: { type: [campaignMemberSchema], default: [] },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    inviteCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    settings: {
      system: { type: String, default: "D&D 5e" },
      allowPlayerEdits: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

campaignSchema.index({ owner: 1, status: 1 });
campaignSchema.index({ "members.user": 1 });

module.exports = mongoose.model("Campaign", campaignSchema);
