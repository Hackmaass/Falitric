import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import authRouter from "./FaltricAuth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS — allow Vite dev server ──────────────────────
app.use(
  cors({
    origin: [process.env.CLIENT_URL || "http://localhost:5173"],
    credentials: true,
  }),
);

// ── Body parsing ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────
app.use("/api/auth", authRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Faltric API",
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── MongoDB connect → start server ───────────────────
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error(
    "❌  MONGODB_URI is not set in server/.env — cannot start server.",
  );
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅  MongoDB connected");
    app.listen(PORT, () =>
      console.log(`🚀  Faltric API running at http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("❌  MongoDB connection error:", err.message);
    process.exit(1);
  });
