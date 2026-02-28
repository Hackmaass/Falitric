import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ethers } from "ethers";

const router = express.Router();

// ─────────────────────────────────────────────────────
//  MongoDB User Schema
// ─────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    wallet_address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true }, // bcrypt hashed
    phone: { type: String, required: true, trim: true },
    electricity_consumer_number: { type: String, required: true, trim: true },
    current_units: { type: Number, default: 0 },
    token_balance: { type: Number, default: 0 }, // FAL token balance (mirror of chain)
    role: {
      type: String,
      enum: ["producer", "consumer", "admin"],
      default: "consumer",
    },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

// ─────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "faltric_dev_secret_change_me";
const JWT_EXPIRES = "7d";

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

/** Verify a SIWE-style personal_sign message and return the recovered address */
function recoverWalletAddress(message, signature) {
  try {
    return ethers.verifyMessage(message, signature);
  } catch {
    return null;
  }
}

/** Middleware: validates Bearer JWT and attaches req.user */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
}

// ─────────────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────────────

/**
 * POST /api/auth/check-wallet
 * Returns whether a wallet address is already registered.
 * Frontend calls this right after MetaMask connects.
 */
router.post("/check-wallet", async (req, res) => {
  const { wallet_address } = req.body;
  if (!wallet_address)
    return res.status(400).json({ error: "wallet_address required" });

  try {
    const user = await User.findOne({
      wallet_address: wallet_address.toLowerCase(),
    }).select("name email wallet_address token_balance");

    res.json({
      exists: !!user,
      user: user || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

/**
 * POST /api/auth/signup
 * Register a new user linked to a verified wallet.
 * Body: { wallet_address, signature, name, email, password, phone, electricity_consumer_number }
 *
 * Wallet ownership is verified by checking that the signed message
 * matches the submitted wallet_address.
 */
router.post("/signup", async (req, res) => {
  const {
    wallet_address,
    signature,
    name,
    email,
    password,
    phone,
    electricity_consumer_number,
  } = req.body;

  // ── Validate required fields ──
  if (
    !wallet_address ||
    !signature ||
    !name ||
    !email ||
    !password ||
    !phone ||
    !electricity_consumer_number
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  // ── Verify wallet ownership via signature ──
  const message = `Sign up for Faltric with wallet: ${wallet_address.toLowerCase()}`;
  const recovered = recoverWalletAddress(message, signature);

  if (!recovered || recovered.toLowerCase() !== wallet_address.toLowerCase()) {
    return res
      .status(400)
      .json({ error: "Wallet signature verification failed" });
  }

  try {
    // ── Check for duplicates ──
    const existing = await User.findOne({
      $or: [
        { wallet_address: wallet_address.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });

    if (existing) {
      const field =
        existing.wallet_address === wallet_address.toLowerCase()
          ? "wallet address"
          : "email";
      return res
        .status(409)
        .json({ error: `An account with this ${field} already exists` });
    }

    // ── Hash password ──
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Create user ──
    const user = await User.create({
      wallet_address: wallet_address.toLowerCase(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      electricity_consumer_number: electricity_consumer_number.trim(),
    });

    const token = signToken({
      id: user._id,
      wallet_address: user.wallet_address,
      email: user.email,
    });

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        wallet_address: user.wallet_address,
        token_balance: user.token_balance,
        current_units: user.current_units,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate an existing user via email + password + wallet signature (SIWE).
 * Body: { email, password, wallet_address, signature }
 */
router.post("/login", async (req, res) => {
  const { email, password, wallet_address, signature } = req.body;

  if (!email || !password || !wallet_address || !signature) {
    return res
      .status(400)
      .json({
        error: "Email, password, wallet address and signature are required",
      });
  }

  try {
    // ── Find user ──
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── Verify password ──
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── Verify wallet matches stored address ──
    if (user.wallet_address !== wallet_address.toLowerCase()) {
      return res.status(401).json({
        error:
          "Connected wallet does not match the account's registered wallet",
      });
    }

    // ── Verify SIWE wallet signature ──
    const message = `Sign in to Faltric: ${wallet_address.toLowerCase()}`;
    const recovered = recoverWalletAddress(message, signature);

    if (
      !recovered ||
      recovered.toLowerCase() !== wallet_address.toLowerCase()
    ) {
      return res
        .status(401)
        .json({ error: "Wallet signature verification failed" });
    }

    const token = signToken({
      id: user._id,
      wallet_address: user.wallet_address,
      email: user.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        wallet_address: user.wallet_address,
        token_balance: user.token_balance,
        current_units: user.current_units,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

/**
 * GET /api/auth/me
 * Protected: returns authenticated user's profile.
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

/**
 * POST /api/auth/verify-wallet
 * Standalone: verify a wallet signature without logging in.
 * Useful for re-verification on sensitive actions.
 * Body: { wallet_address, message, signature }
 */
router.post("/verify-wallet", async (req, res) => {
  const { wallet_address, message, signature } = req.body;

  if (!wallet_address || !message || !signature) {
    return res
      .status(400)
      .json({ error: "wallet_address, message, and signature are required" });
  }

  const recovered = recoverWalletAddress(message, signature);
  const valid =
    !!recovered && recovered.toLowerCase() === wallet_address.toLowerCase();

  res.json({ valid, recovered: recovered?.toLowerCase() || null });
});

/**
 * PATCH /api/auth/update-units
 * Protected: update the energy unit count for the authenticated user.
 * Body: { units_to_add: Number }
 */
router.patch("/update-units", requireAuth, async (req, res) => {
  const { units_to_add } = req.body;

  if (typeof units_to_add !== "number" || units_to_add <= 0) {
    return res
      .status(400)
      .json({ error: "units_to_add must be a positive number" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { current_units: units_to_add } },
      { new: true },
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      message: "Units updated",
      current_units: user.current_units,
      pending_tokens: Math.floor(user.current_units / 100),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

export default router;
