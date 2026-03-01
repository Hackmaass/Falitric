import React, { useState } from "react";
import { database, ref, update } from "../../firebase";
import NeoInput from "./NeoInput";

function LoginScreen({
  walletAddress,
  signer,
  onSuccess,
  onSwitchToSignup,
  getUserByWallet,
  verifySignature,
  getChainBalance,
  walletKey,
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email) return setStatus({ type: "error", msg: "Email is required." });

    setLoading(true);
    setStatus(null);

    try {
      const user = await getUserByWallet(walletAddress);
      if (!user)
        return setStatus({
          type: "error",
          msg: "No account found for this wallet. Please sign up.",
        });
      if (user.email?.toLowerCase() !== email.toLowerCase())
        return setStatus({
          type: "error",
          msg: "Email does not match the account registered to this wallet.",
        });

      setStatus({
        type: "info",
        msg: "Sign the verification message in MetaMask…",
      });

      const message = `Sign in to Faltric\nWallet: ${walletAddress.toLowerCase()}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      if (!(await verifySignature(message, signature, walletAddress)))
        return setStatus({ type: "error", msg: "Wallet signature invalid." });

      const chainBalance = await getChainBalance(walletAddress, signer);

      const freshUser = (await getUserByWallet(walletAddress)) || user;

      let location = null;
      if (navigator.geolocation) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 5000 },
          );
        });
      }

      await update(ref(database, `faltric_users/${walletKey(walletAddress)}`), {
        token_balance: chainBalance,
        last_login_location: location,
      });
      freshUser.token_balance = chainBalance;
      freshUser.last_login_location = location;

      const { password: _p, ...safe } = freshUser;
      localStorage.setItem("faltric_user", JSON.stringify(safe));
      setStatus({ type: "success", msg: "Welcome back! 🌿" });
      setTimeout(() => onSuccess(safe), 600);
    } catch (err) {
      if (err.code === "ACTION_REJECTED")
        setStatus({
          type: "error",
          msg: "Signature cancelled. Please try again.",
        });
      else setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="faltric-card">
      <h2>Sign In</h2>
      <span className="card-subtitle">
        Wallet recognised — confirm your email to continue
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
        <button
          id="btn-login-submit"
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

export default LoginScreen;
