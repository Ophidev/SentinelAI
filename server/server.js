import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import connectDB from "./src/config/db.js";

const PORT = process.env.PORT || 5000;

// Connect Database
await connectDB();

app.listen(PORT, () => {
  console.log(`🚀 SentinelAI Backend running on http://localhost:${PORT}`);
});