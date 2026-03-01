import React from "react";

function ConnectScreen({ onConnect, onAdminLogin, loading, error }) {
  return (
    <div className="faltric-card">
      <div className="faltric-connect-screen">
        <div className="wallet-icon">⚡</div>
        <div>
          <h2 style={{ color: "#fff", marginBottom: "0.5rem" }}>
            Wallet-First Access
          </h2>
          <p>
            Connect your MetaMask wallet to access Faltric's decentralised
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
        <button
          className="btn-neo"
          onClick={onAdminLogin}
          style={{ background: "#6b8a1e", color: "#fff", marginTop: "4px" }}
        >
          🛡️ Admin Login
        </button>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
          No wallet?{" "}
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

export default ConnectScreen;
