require("dotenv").config();
const serverless = require("serverless-http");
const app = require("../src/app");
const connectDB = require("../src/config/db");
const { initSrdLookup } = require("../src/services/srd-lookup.service");

let isReady = false;

const ensureReady = async () => {
  if (isReady) return;
  await connectDB();
  await initSrdLookup();
  isReady = true;
};

app.use(async (req, res, next) => {
  await ensureReady();
  next();
});

module.exports = serverless(app);
