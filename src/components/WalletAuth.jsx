import React, { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { database, ref, get, update, set } from "../firebase";
import Navbar from "./Navbar";
import "./WalletAuth.css";

// Lazy load screens to optimize initial bundle size
const ConnectScreen = lazy(() => import("./auth/ConnectScreen"));
const AdminLoginScreen = lazy(() => import("./auth/AdminLoginScreen"));
const SignupScreen = lazy(() => import("./auth/SignupScreen"));
const LoginScreen = lazy(() => import("./auth/LoginScreen"));

// ERC20 Contract syncing
const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const TOKEN_ADDRESS = import.meta.env.VITE_FAL_TOKEN_ADDRESS;

// --- Shared Utilities (kept here for now, or could move to a separate utils file) ---

async function getChainBalance(walletAddress, providerOrSigner) {
  if (!TOKEN_ADDRESS || walletAddress === "admin") return 0;
  try {
    const { ethers } = await import("ethers");
    const contract = new ethers.Contract(
      TOKEN_ADDRESS,
      ERC20_ABI,
      providerOrSigner,
    );
    const code = await providerOrSigner.getCode(TOKEN_ADDRESS);
    if (code === "0x" || code === "0x0") return 0;
    const bal = await contract.balanceOf(walletAddress);
    return Number(ethers.formatUnits(bal, 18));
  } catch (err) {
    if (err.code !== "BAD_DATA") {
      console.warn("Chain balance fetch skipped:", err.message);
    }
    return 0;
  }
}

const walletKey = (addr) => addr?.toLowerCase().replace(/[.#$[\]]/g, "_") || "";

async function connectMetaMask() {
  if (!window.ethereum)
    throw new Error("MetaMask is not installed. Get it at metamask.io");
  const { ethers } = await import("ethers");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { signer, address };
}

async function getUserByWallet(walletAddress) {
  const snap = await get(
    ref(database, `faltric_users/${walletKey(walletAddress)}`),
  );
  return snap.exists() ? snap.val() : null;
}

async function emailExists(email) {
  const snap = await get(ref(database, "faltric_users"));
  if (!snap.exists()) return false;
  return Object.values(snap.val()).some(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
}

async function createUser(walletAddress, data, initialBalance = 0) {
  await set(ref(database, `faltric_users/${walletKey(walletAddress)}`), {
    ...data,
    wallet_address: walletAddress.toLowerCase(),
    current_units: 0,
    token_balance: initialBalance,
    role: "consumer",
    createdAt: Date.now(),
  });
}

async function verifySignature(message, signature, expectedAddress) {
  try {
    const { ethers } = await import("ethers");
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

// --- Main Component ---

export default function WalletAuth({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("faltric_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [walletAddress, setWalletAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [screen, setScreen] = useState("connect");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState(null);

  useEffect(() => {
    if (!user || user.role === "admin" || !user.wallet_address) return;

    const syncBalance = async () => {
      let chainBal = null;
      if (window.ethereum) {
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.BrowserProvider(window.ethereum);
          chainBal = await getChainBalance(user.wallet_address, provider);
        } catch (err) {
          console.warn("Sync: Provider error", err.message);
        }
      }

      try {
        const snap = await get(
          ref(database, `faltric_users/${walletKey(user.wallet_address)}`),
        );
        if (snap.exists()) {
          const dbData = snap.val();
          let fresh = { ...user, ...dbData };
          const dbBal = dbData.token_balance ?? 0;

          // If on-chain balance is higher or DB balance is missing, update DB
          if (
            chainBal !== null &&
            (dbData.token_balance === undefined || chainBal > dbBal)
          ) {
            fresh.token_balance = chainBal;
            await update(
              ref(database, `faltric_users/${walletKey(user.wallet_address)}`),
              {
                token_balance: chainBal,
              },
            );
          }

          setUser(fresh);
          localStorage.setItem("faltric_user", JSON.stringify(fresh));
        }
      } catch (err) {
        console.error("Sync: Firebase error", err);
      }
    };

    syncBalance(); // Initial run
    const interval = setInterval(syncBalance, 30000); // Periodic sync every 30s
    return () => clearInterval(interval);
  }, [user?.wallet_address, user?.role]); // eslint-disable-line

  const handleConnect = useCallback(async () => {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const { signer: s, address } = await connectMetaMask();
      setWalletAddress(address);
      setSigner(s);
      const existing = await getUserByWallet(address);
      setScreen(existing ? "login" : "signup");
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setConnectLoading(false);
    }
  }, []);

  useEffect(() => {
    window.connectFaltricWallet = handleConnect;
    return () => {
      delete window.connectFaltricWallet;
    };
  }, [handleConnect]);

  const handleLogout = () => {
    localStorage.removeItem("faltric_user");
    setUser(null);
    setWalletAddress(null);
    setSigner(null);
    setScreen("connect");
  };

  if (user) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="flex-1 flex flex-col">
          {typeof children === "function" ? children(user) : children}
        </div>
      </div>
    );
  }

  return (
    <div className="faltric-auth-gate">
      <div className="faltric-brand">
        <span className="brand-tag">Execute Hackathon 2026</span>
        <h1>Faltric</h1>
        <p>Decentralised Renewable Energy Marketplace</p>
      </div>

      <Suspense
        fallback={
          <div className="faltric-card flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        }
      >
        {screen === "connect" && (
          <ConnectScreen
            onConnect={handleConnect}
            onAdminLogin={() => setScreen("admin")}
            loading={connectLoading}
            error={connectError}
          />
        )}
        {screen === "admin" && (
          <AdminLoginScreen
            onAdminSuccess={setUser}
            onSwitchToWallet={() => setScreen("connect")}
          />
        )}
        {screen === "signup" && walletAddress && (
          <SignupScreen
            walletAddress={walletAddress}
            signer={signer}
            onSuccess={setUser}
            onSwitchToLogin={() => setScreen("login")}
            emailExists={emailExists}
            verifySignature={verifySignature}
            getChainBalance={getChainBalance}
            createUser={createUser}
          />
        )}
        {screen === "login" && walletAddress && (
          <LoginScreen
            walletAddress={walletAddress}
            signer={signer}
            onSuccess={setUser}
            onSwitchToSignup={() => setScreen("signup")}
            getUserByWallet={getUserByWallet}
            verifySignature={verifySignature}
            getChainBalance={getChainBalance}
            walletKey={walletKey}
          />
        )}
      </Suspense>
    </div>
  );
}
