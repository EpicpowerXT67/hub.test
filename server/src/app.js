const express = require("express");
const cors = require("cors");
const trackRoutes = require("./routes/track.routes");
const authRoutes = require("./routes/auth.routes");
const gameRoutes = require("./routes/game.routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

// 1. Global middleware
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://0.0.0.0:5173",
  "http://0.0.0.0:5174",
  "http://0.0.0.0:5175",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://0.0.0.0:4173",
].filter(Boolean);

const isLocalDevOrigin = (origin) => {
  if (!origin) return true;

  try {
    const { hostname, port } = new URL(origin);
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
    const isLocalHost = localHosts.has(hostname);
    const isLocalNetwork = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
    const allowedPort = ["5173", "5174", "5175", "4173", "3000", "8080"].includes(port) || !port;

    return allowedOrigins.includes(origin) || (isLocalHost || isLocalNetwork) && allowedPort;
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isLocalDevOrigin(origin)) return callback(null, true);
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());

// 2. Routes
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api", gameRoutes);
app.use("/api/tracks", trackRoutes);

// 3. Error handling — must be LAST
app.use(notFound);
app.use(errorHandler);

module.exports = app;
