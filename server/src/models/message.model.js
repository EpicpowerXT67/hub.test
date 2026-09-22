const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  role: { type: String, enum: ["player", "dm"], required: true },
  content: { type: String, required: true, maxlength: 12000 },
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
