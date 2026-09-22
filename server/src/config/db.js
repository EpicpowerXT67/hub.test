const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("Missing MONGO_URI or MONGODB_URI environment variable");
    }

    try {
        await mongoose.connect(mongoUri);
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        throw error;
   }
};
module.exports = connectDB;