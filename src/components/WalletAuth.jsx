import React, { useState, useCallback } from "react";
import { ethers } from "ethers";
import "./WalletAuth.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// ── Truncate wallet address for display ──────────────
const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

// ── Request MetaMask connection ───────────────────────
async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install it from metamask.io",
    );
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

// ── Sign an arbitrary message with MetaMask ──────────
async function signMessage(signer, message) {
  return signer.signMessage(message);
}

// ── POST helper ───────────────────────────────────────
async function post(endpoint, body) {
  const res = await fetch(`${API_BASE}/api/auth${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────

/** Reusable neo-brutalist input */
const NeoInput = ({ label, id, ...props }) => (
  <div className="form-group">
    {label && <label htmlFor={id}>{label}</label>}
    <input id={id} className="neo-input" {...props} />
  </div>
);

/** Screen 1 — Connect Wallet */
function ConnectScreen({ onConnect, loading, error }) {
  return (
    <div className="faltric-card">
      <div className="faltric-connect-screen">
        <div className="wallet-icon">⚡</div>
        <div>
          <h2 style={{ color: "#fff", marginBottom: "0.5rem" }}>
            Wallet-First Login
          </h2>
          <p>
            Connect your MetaMask wallet to access Faltric's decentralized
            renewable energy marketplace.
          </p>
        </div>
        <button
          id="btn-connect-wallet"
          className="btn-neo btn-yellow"
          onClick={onConnect}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" /> Connecting…
            </>
          ) : (
            <>🦊 Connect MetaMask</>
          )}
        </button>
        {error && <div className="faltric-status error">{error}</div>}
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
          No wallet yet?{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#FBC02D" }}
          >
            Install MetaMask →
          </a>
        </p>
      </div>
    </div>
  );
}

/** Screen 2 — Sign Up */
function SignupScreen({ walletAddress, signer, onSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    electricity_consumer_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      setStatus({ type: "info", msg: "Please sign the message in MetaMask…" });

      const message = `Sign up for Faltric with wallet: ${walletAddress.toLowerCase()}`;
      const signature = await signMessage(signer, message);

      setStatus({ type: "info", msg: "Creating your account…" });
      const data = await post("/signup", {
        ...form,
        wallet_address: walletAddress,
        signature,
      });

      localStorage.setItem("faltric_token", data.token);
      localStorage.setItem("faltric_user", JSON.stringify(data.user));
      setStatus({
        type: "success",
        msg: "Account created! Welcome to Faltric 🌿",
      });

      setTimeout(() => onSuccess(data.user), 800);
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="faltric-card">
      <h2>Create Account</h2>
      <span className="card-subtitle">
        New wallet detected — register to start trading energy
      </span>

      <div className="wallet-badge">
        <span className="dot" />
        <span className="addr">{walletAddress}</span>
      </div>

      <form onSubmit={handleSignup} noValidate>
        <NeoInput
          label="Full Name"
          id="signup-name"
          name="name"
          type="text"
          placeholder="Sarthak Patil"
          value={form.name}
          onChange={handleChange}
          required
        />

        <div className="form-row">
          <NeoInput
            label="Email"
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
          />
          <NeoInput
            label="Phone"
            id="signup-phone"
            name="phone"
            type="tel"
            placeholder="+91 9876543210"
            value={form.phone}
            onChange={handleChange}
            required
          />
        </div>

        <NeoInput
          label="Consumer Number (Electricity)"
          id="signup-consumer"
          name="electricity_consumer_number"
          type="text"
          placeholder="MH12345678"
          value={form.electricity_consumer_number}
          onChange={handleChange}
          required
        />

        <NeoInput
          label="Password (min 8 characters)"
          id="signup-password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          required
          minLength={8}
        />

        <button
          id="btn-signup-submit"
          type="submit"
          className="btn-neo btn-green"
          disabled={loading}
          style={{ marginTop: "0.5rem" }}
        >
          {loading ? (
            <>
              <span className="spinner" /> Processing…
            </>
          ) : (
            "🌿 Create Faltric Account"
          )}
        </button>
      </form>

      {status && (
        <div className={`faltric-status ${status.type}`}>{status.msg}</div>
      )}

      <div className="mode-toggle">
        <button type="button" onClick={onSwitchToLogin}>
          Already have an account? Sign in instead
        </button>
      </div>
    </div>
  );
}

/** Screen 3 — Login */
function LoginScreen({ walletAddress, signer, onSuccess, onSwitchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      setStatus({
        type: "info",
        msg: "Please sign the verification message in MetaMask…",
      });

      const message = `Sign in to Faltric: ${walletAddress.toLowerCase()}`;
      const signature = await signMessage(signer, message);

      setStatus({ type: "info", msg: "Verifying credentials…" });
      const data = await post("/login", {
        email,
        password,
        wallet_address: walletAddress,
        signature,
      });

      localStorage.setItem("faltric_token", data.token);
      localStorage.setItem("faltric_user", JSON.stringify(data.user));
      setStatus({ type: "success", msg: "Welcome back! 🌿" });

      setTimeout(() => onSuccess(data.user), 600);
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="faltric-card">
      <h2>Sign In</h2>
      <span className="card-subtitle">
        Wallet found — verify your identity to continue
      </span>

      <div className="wallet-badge">
        <span className="dot" />
        <span className="addr">{walletAddress}</span>
      </div>

      <form onSubmit={handleLogin} noValidate>
        <NeoInput
          label="Email"
          id="login-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <NeoInput
          label="Password"
          id="login-password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          id="btn-login-submit"
          type="submit"
          className="btn-neo btn-green"
          disabled={loading}
          style={{ marginTop: "0.5rem" }}
        >
          {loading ? (
            <>
              <span className="spinner" /> Signing in…
            </>
          ) : (
            "⚡ Sign In & Verify Wallet"
          )}
        </button>
      </form>

      {status && (
        <div className={`faltric-status ${status.type}`}>{status.msg}</div>
      )}

      <div className="mode-toggle">
        <button type="button" onClick={onSwitchToSignup}>
          New wallet? Create an account
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Main WalletAuth Gate
// ─────────────────────────────────────────────────────

/**
 * WalletAuth — Wallet-first authentication gate.
 *
 * Render children only when the user is authenticated.
 * Wraps the authenticated state in a Faltric top-bar.
 *
 * Usage:
 *   <WalletAuth>
 *     <YourApp />
 *   </WalletAuth>
 */
export default function WalletAuth({ children }) {
  // ── Restore session from localStorage ──
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("faltric_user");
      const token = localStorage.getItem("faltric_token");
      if (stored && token) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [walletAddress, setWalletAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [screen, setScreen] = useState("connect"); // connect | signup | login
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState(null);

  // ── Handle MetaMask connect ──
  const handleConnect = useCallback(async () => {
    setConnectLoading(true);
    setConnectError(null);

    try {
      const { signer: s, address } = await connectMetaMask();
      setWalletAddress(address);
      setSigner(s);

      // Check if wallet is registered
      const result = await post("/check-wallet", { wallet_address: address });
      setScreen(result.exists ? "login" : "signup");
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setConnectLoading(false);
    }
  }, []);

  // ── Handle logout ──
  const handleLogout = () => {
    localStorage.removeItem("faltric_token");
    localStorage.removeItem("faltric_user");
    setUser(null);
    setWalletAddress(null);
    setSigner(null);
    setScreen("connect");
  };

  // ── Authenticated → render app shell + children ──
  if (user) {
    return (
      <div className="faltric-app-shell">
        <header className="faltric-topbar">
          <span className="topbar-brand">⚡ Faltric</span>
          <div className="topbar-wallet">
            {user.token_balance !== undefined && (
              <span className="fal-balance">
                🪙 {user.token_balance.toFixed(2)} FAL
              </span>
            )}
            <span className="topbar-addr">
              {shortAddr(user.wallet_address)}
            </span>
            <button
              id="btn-logout"
              className="btn-logout"
              onClick={handleLogout}
            >
              Disconnect
            </button>
          </div>
        </header>
        <div className="faltric-app-content">{children}</div>
      </div>
    );
  }

  // ── Unauthenticated → auth gate ──
  return (
    <div className="faltric-auth-gate">
      {/* Brand Header */}
      <div className="faltric-brand">
        <span className="brand-tag">Execute Hackathon 2026</span>
        <h1>Faltric</h1>
        <p>Decentralized Renewable Energy Marketplace</p>
      </div>

      {/* Auth Card */}
      {screen === "connect" && (
        <ConnectScreen
          onConnect={handleConnect}
          loading={connectLoading}
          error={connectError}
        />
      )}

      {screen === "signup" && walletAddress && (
        <SignupScreen
          walletAddress={walletAddress}
          signer={signer}
          onSuccess={setUser}
          onSwitchToLogin={() => setScreen("login")}
        />
      )}

      {screen === "login" && walletAddress && (
        <LoginScreen
          walletAddress={walletAddress}
          signer={signer}
          onSuccess={setUser}
          onSwitchToSignup={() => setScreen("signup")}
        />
      )}
    </div>
  );
}
