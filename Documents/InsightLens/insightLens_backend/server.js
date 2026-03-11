import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import sentimentRoutes from "./routes/sentimentRoutes.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "https://insight-lens-nine.vercel.app/",
    "http://localhost:5173"
  ],
  credentials: true
}));
app.use(express.json());
app.get("/", (req, res) => {
  res.json({
    status: "Backend running",
    service: "InsightLens API"
  });
});
/* ROUTES */

app.use("/api/auth", authRoutes);
app.use("/api/sentiment", sentimentRoutes);

/* MONGODB CONNECTION */

const PORT = process.env.PORT || 5000;
const ALLOW_AUTH_FALLBACK = process.env.ALLOW_AUTH_FALLBACK !== "false"
const DB_CONNECT_TIMEOUT_MS = 8000

const connectWithTimeout = async (uri, timeoutMs) => {
  await Promise.race([
    mongoose.connect(uri),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Mongo connection timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ])
}

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in environment")
  }

  if (process.env.MONGO_URI) {
    try {
      await connectWithTimeout(process.env.MONGO_URI, DB_CONNECT_TIMEOUT_MS)
      console.log("MongoDB Atlas Connected")
    } catch (err) {
      if (!ALLOW_AUTH_FALLBACK) {
        throw err
      }
      console.warn("MongoDB unavailable; running with in-memory auth fallback mode")
    }
  } else if (!ALLOW_AUTH_FALLBACK) {
    throw new Error("Missing MONGO_URI in environment")
  } else {
    console.warn("MONGO_URI missing; running with in-memory auth fallback mode")
  }

  app.listen(PORT, () => {
    console.log(`InsightLens server running on port ${PORT}`)
  })
}

startServer().catch((err) => {
  console.error("Server startup failed:", err.message)
  process.exit(1)
})
