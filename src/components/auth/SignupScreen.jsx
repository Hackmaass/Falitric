import React, { useState } from "react";
import NeoInput from "./NeoInput";

function SignupScreen({
  walletAddress,
  signer,
  onSuccess,
  onSwitchToLogin,
  emailExists,
  verifySignature,
  getChainBalance,
  createUser,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    electricity_consumer_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    if (
      !form.name ||
      !form.email ||
      !form.phone ||
      !form.electricity_consumer_number
    )
      return setStatus({ type: "error", msg: "All fields are required." });

    setLoading(true);
    setStatus(null);

    try {
      if (await emailExists(form.email))
        return setStatus({
          type: "error",
          msg: "An account with this email already exists.",
        });

      setStatus({
        type: "info",
        msg: "Please sign the message in MetaMask to verify wallet ownership…",
      });

      const message = `Register on Faltric\nWallet: ${walletAddress.toLowerCase()}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      if (!(await verifySignature(message, signature, walletAddress)))
        return setStatus({ type: "error", msg: "Wallet signature invalid." });

      const chainBalance = await getChainBalance(walletAddress, signer);

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

      await createUser(
        walletAddress,
        {
          name: form.name.trim(),
          email: form.email.toLowerCase().trim(),
          phone: form.phone.trim(),
          electricity_consumer_number: form.electricity_consumer_number.trim(),
          last_login_location: location,
        },
        chainBalance,
      );

      const userData = {
        wallet_address: walletAddress.toLowerCase(),
        name: form.name.trim(),
        email: form.email.toLowerCase().trim(),
        token_balance: chainBalance,
        current_units: 0,
        role: "consumer",
      };

      localStorage.setItem("faltric_user", JSON.stringify(userData));
      setStatus({ type: "success", msg: "Welcome to Faltric! 🌿" });
      setTimeout(() => onSuccess(userData), 700);
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
          label="Electricity Consumer Number"
          id="signup-consumer"
          name="electricity_consumer_number"
          type="text"
          placeholder="MH12345678"
          value={form.electricity_consumer_number}
          onChange={handleChange}
          required
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

export default SignupScreen;
