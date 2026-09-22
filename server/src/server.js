require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { initSrdLookup } = require("./services/srd-lookup.service");

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
    await initSrdLookup();
    app.listen(PORT, () => console.log(`Server running on
http://localhost:${PORT}`));
}).catch((error) => { console.error("Server startup failed:", error.message); process.exit(1); });
