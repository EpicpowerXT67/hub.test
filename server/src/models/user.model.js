const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    password: { type: String, required: true, minlength: 8, select: false },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    profile: { type: String, required: false },
  },
  { timestamps: true }
);

// Mongoose 9 no longer passes a `next` callback to async middleware.
// Calling it caused registration to fail with "next is not a function".
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("user", userSchema);
