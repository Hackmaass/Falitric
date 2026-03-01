import React, { useState } from "react";
import NeoInput from "./NeoInput";

const ADMIN_EMAIL = "test@admin.com";
const ADMIN_PASSWORD = "testadmin";

function AdminLoginScreen({ onAdminSuccess, onSwitchToWallet }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 400)); // slight UX delay
    if (
      email.trim().toLowerCase() === ADMIN_EMAIL &&
      password === ADMIN_PASSWORD
    ) {
      const adminUser = {
        wallet_address: "admin",
        name: "Grid Admin",
        email: ADMIN_EMAIL,
        token_balance: 0,
        current_units: 0,
        role: "admin",
      };
      localStorage.setItem("faltric_user", JSON.stringify(adminUser));
      onAdminSuccess(adminUser);
    } else {
      setError("Invalid credentials. Check email and password.");
    }
    setLoading(false);
  };

  return (
    <div className="faltric-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "6px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ color: "#6b8a1e", fontSize: "32px" }}
        >
          admin_panel_settings
        </span>
        <h2 style={{ margin: 0 }}>Admin Login</h2>
      </div>
      <span className="card-subtitle">
        Restricted access — Grid Controllers only
      </span>

      <form onSubmit={handleLogin} noValidate>
        <NeoInput
          label="Admin Email"
          id="admin-email"
          name="email"
          type="email"
          placeholder="test@admin.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <NeoInput
          label="Password"
          id="admin-password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          id="btn-admin-login"
          type="submit"
          className="btn-neo btn-green"
          disabled={loading}
          style={{ marginTop: "0.5rem" }}
        >
          {loading ? (
            <>
              <span className="spinner" /> Verifying…
            </>
          ) : (
            "🛡️ Enter Admin Panel"
          )}
        </button>
      </form>

      {error && <div className="faltric-status error">{error}</div>}

      <div className="mode-toggle">
        <button type="button" onClick={onSwitchToWallet}>
          ← Back to Wallet Login
        </button>
      </div>
    </div>
  );
}

export default AdminLoginScreen;
