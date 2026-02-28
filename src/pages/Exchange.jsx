// Exchange — Faltric P2P Energy Exchange with Firebase backend
import { useState, useEffect, useCallback } from "react";
import { database, ref, push, onValue, get, set, update } from "../firebase";

const walletKey = (addr) => addr?.toLowerCase().replace(/[.#$[\]]/g, "_") || "";

export default function Exchange({ user }) {
  const [side, setSide] = useState("buy");
  const [price, setPrice] = useState("1.05");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState("limit");
  const [orders, setOrders] = useState([]);
  const [myTrades, setMyTrades] = useState([]);
  const [balance, setBalance] = useState(user?.token_balance ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Live chart data state
  const [chartData, setChartData] = useState([
    40, 60, 45, 80, 55, 70, 90, 65, 50, 75, 60, 85, 95, 70, 55, 40, 30, 50, 65,
    80, 70, 45, 60, 75,
  ]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Real-time order book from Firebase
  useEffect(() => {
    const unsub = onValue(ref(database, "faltric_orders"), (snap) => {
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([key, val]) => ({
          id: key,
          ...val,
        }));
        setOrders(
          all
            .filter((o) => o.status === "open")
            .sort((a, b) => b.price - a.price),
        );
      } else {
        setOrders([]);
      }
    });
    return () => unsub();
  }, []);

  // Live chart animation
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData((prev) => {
        const newData = [...prev];
        newData.shift(); // remove first element
        // Add random new bar (30 to 95)
        newData.push(Math.floor(Math.random() * 65) + 30);
        return newData;
      });
    }, 1500); // Shift every 1.5 seconds

    return () => clearInterval(interval);
  }, []);

  // My trades
  useEffect(() => {
    if (!user?.wallet_address) return;
    const unsub = onValue(ref(database, "faltric_trades"), (snap) => {
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([key, val]) => ({
          id: key,
          ...val,
        }));
        setMyTrades(
          all
            .filter(
              (t) =>
                t.buyer === user.wallet_address ||
                t.seller === user.wallet_address,
            )
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10),
        );
      }
    });
    return () => unsub();
  }, [user?.wallet_address]);

  // Sync balance
  useEffect(() => {
    if (!user?.wallet_address) return;
    const unsub = onValue(
      ref(
        database,
        `faltric_users/${walletKey(user.wallet_address)}/token_balance`,
      ),
      (snap) => {
        if (snap.exists()) setBalance(snap.val());
      },
    );
    return () => unsub();
  }, [user?.wallet_address]);

  // Execute trade: match against existing orders or place new one
  const handleExecute = useCallback(async () => {
    if (!user?.wallet_address)
      return showToast("Connect your wallet first", "error");
    if (!amount || parseFloat(amount) <= 0)
      return showToast("Enter a valid amount", "error");
    if (!price || parseFloat(price) <= 0)
      return showToast("Enter a valid price", "error");

    const qty = parseFloat(amount);
    const px = parseFloat(price);
    const total = qty * px;

    // Check balance
    if (side === "buy" && balance < total)
      return showToast("Insufficient FAL balance", "error");

    setSubmitting(true);
    try {
      // Try to match against opposite side orders
      const opposites = orders.filter(
        (o) =>
          o.side !== side &&
          o.wallet !== user.wallet_address &&
          parseFloat(o.amount) >= qty &&
          (side === "buy"
            ? parseFloat(o.price) <= px
            : parseFloat(o.price) >= px),
      );

      if (opposites.length > 0 && side === "buy") {
        // Execute trade against best matching ask
        const match = opposites[opposites.length - 1]; // lowest ask for buy
        const matchTotal = qty * parseFloat(match.price);
        const sellerKey = walletKey(match.wallet);
        const buyerKey = walletKey(user.wallet_address);

        // Update balances
        const sellerSnap = await get(
          ref(database, `faltric_users/${sellerKey}/token_balance`),
        );
        const buyerSnap = await get(
          ref(database, `faltric_users/${buyerKey}/token_balance`),
        );
        const sellerBal = sellerSnap.exists() ? sellerSnap.val() : 0;
        const buyerBal = buyerSnap.exists() ? buyerSnap.val() : 0;

        await update(ref(database, `faltric_users/${sellerKey}`), {
          token_balance: sellerBal + matchTotal,
        });
        await update(ref(database, `faltric_users/${buyerKey}`), {
          token_balance: buyerBal - matchTotal,
        });

        // Close the matched order
        await update(ref(database, `faltric_orders/${match.id}`), {
          status: "filled",
        });

        // Record trade
        await push(ref(database, "faltric_trades"), {
          buyer: user.wallet_address,
          seller: match.wallet,
          amount: qty,
          price: parseFloat(match.price),
          total: matchTotal,
          timestamp: Date.now(),
          type: "P2P Energy Sale",
        });

        showToast(`✅ Bought ${qty} Units @ ${match.price} USDC!`);
      } else if (opposites.length > 0 && side === "sell") {
        // Execute trade against best matching bid
        const match = opposites[0]; // highest bid for sell
        const matchTotal = qty * parseFloat(match.price);
        const buyerKey = walletKey(match.wallet);
        const sellerKey = walletKey(user.wallet_address);

        const buyerSnap = await get(
          ref(database, `faltric_users/${buyerKey}/token_balance`),
        );
        const sellerSnap = await get(
          ref(database, `faltric_users/${sellerKey}/token_balance`),
        );
        const buyerBal = buyerSnap.exists() ? buyerSnap.val() : 0;
        const sellerBal = sellerSnap.exists() ? sellerSnap.val() : 0;

        await update(ref(database, `faltric_users/${buyerKey}`), {
          token_balance: buyerBal - matchTotal,
        });
        await update(ref(database, `faltric_users/${sellerKey}`), {
          token_balance: sellerBal + matchTotal,
        });
        await update(ref(database, `faltric_orders/${match.id}`), {
          status: "filled",
        });

        await push(ref(database, "faltric_trades"), {
          buyer: match.wallet,
          seller: user.wallet_address,
          amount: qty,
          price: parseFloat(match.price),
          total: matchTotal,
          timestamp: Date.now(),
          type: "P2P Energy Sale",
        });

        showToast(`✅ Sold ${qty} Units @ ${match.price} USDC!`);
      } else {
        // No match – place open order
        await push(ref(database, "faltric_orders"), {
          wallet: user.wallet_address,
          name: user.name || "Anonymous",
          side,
          price: px,
          amount: qty,
          total,
          status: "open",
          timestamp: Date.now(),
        });
        showToast(
          `📋 Order placed: ${side === "buy" ? "Buy" : "Sell"} ${qty} Units @ ${px} USDC`,
        );
      }

      setAmount("");
    } catch (err) {
      showToast(err.message || "Transaction failed", "error");
    } finally {
      setSubmitting(false);
    }
  }, [side, price, amount, orders, user, balance]);

  // Split order book into asks and bids
  const asks = orders.filter((o) => o.side === "sell").slice(0, 5);
  const bids = orders.filter((o) => o.side === "buy").slice(0, 5);

  return (
    <main className="flex-grow flex flex-col pt-32 px-4 pb-12 w-full max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-xl font-bold text-sm shadow-2xl transition-all border ${toast.type === "error" ? "bg-red-900/80 text-red-200 border-red-500/50 backdrop-blur" : "bg-emerald-900/80 text-emerald-200 border-emerald-500/50 backdrop-blur"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Hero row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 items-end relative z-10">
        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md shadow-lg w-max">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
            <span className="text-xs font-medium tracking-wide text-white/80 uppercase">
              Live Market
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-white mb-2 leading-tight drop-shadow-lg">
            P2P Energy
            <br />
            <span className="text-white/40">Exchange</span>
          </h2>
          <p className="text-[#A1A1AA] font-light max-w-xl text-base leading-relaxed">
            Decentralized renewable energy trading via smart contracts. 1 FAL =
            0.01 ETH = 400 Units.
          </p>
        </div>
        <div className="md:col-span-5 lg:col-span-4 flex gap-4 justify-end">
          <div className="skeuo-card p-5 flex-1 rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-white/5 transition-transform group-hover:scale-110 duration-500">
              <span className="material-symbols-outlined !text-[80px]">
                account_balance_wallet
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase mb-2 relative z-10">
              My Balance
            </p>
            <p className="text-3xl font-bold text-white relative z-10 font-mono tracking-tight">
              {balance.toLocaleString()}{" "}
              <span className="text-xs font-semibold align-top text-white/40 ml-1">
                FAL
              </span>
            </p>
          </div>
          <div className="skeuo-card p-5 flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase mb-2">
              Current Rate
            </p>
            <p className="text-3xl font-bold text-white font-mono tracking-tight">
              1.05{" "}
              <span className="text-xs font-semibold align-top text-white/40 ml-1">
                USDC
              </span>
            </p>
            <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined !text-[14px]">
                trending_up
              </span>
              +2.8% today
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left: Order Book */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          {/* Live chart (decorative) */}
          <div className="w-full h-56 rounded-2xl border border-white/10 relative overflow-hidden bg-[#0A0A0A] shadow-inner">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-full w-full pointer-events-none translate-y-[-100%] animate-[scan_3s_ease-in-out_infinite]"></div>

            <div className="absolute bottom-0 left-0 right-0 h-40 flex items-end px-4 gap-1.5 pb-4">
              {chartData.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all duration-1000 ease-in-out hover:opacity-100 opacity-60"
                  style={{
                    height: `${h}%`,
                    background:
                      "linear-gradient(to top, rgba(16, 185, 129, 0.4), rgba(16, 185, 129, 0.05))",
                    borderTop: "1px solid rgba(16, 185, 129, 0.6)",
                  }}
                />
              ))}
            </div>
            <div className="absolute top-0 left-0 p-5 w-full flex justify-between items-start">
              <div className="flex items-center gap-2 border border-white/10 rounded-lg bg-black/40 backdrop-blur-md px-3 py-1.5 shadow-sm">
                <span className="size-2 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]" />
                <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                  Market Depth
                </span>
              </div>
              <div className="text-right glass-nav px-4 py-2 rounded-xl">
                <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-semibold">
                  VOL 24H
                </div>
                <div className="text-lg font-bold text-white mt-0.5 font-mono">
                  45,200{" "}
                  <span className="text-[10px] text-white/50">Units</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Book */}
          <div className="skeuo-card rounded-2xl overflow-hidden border border-white/10 flex flex-col flex-1">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-lg font-semibold text-white uppercase flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined !text-[20px] text-white/60">
                  list_alt
                </span>
                Order Book
              </h3>
              <span className="text-[10px] text-white/60 font-semibold uppercase bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                {orders.length} Open Orders
              </span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-[#A1A1AA] font-semibold border-b border-white/5 bg-black/20 tracking-wider">
                    <th className="px-6 py-4 font-mono">Side</th>
                    <th className="px-6 py-4 font-mono">Price (USDC)</th>
                    <th className="px-6 py-4 font-mono">Amount (Units)</th>
                    <th className="px-6 py-4 text-right font-mono">Total</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono text-white/90">
                  {asks.length === 0 && bids.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-16 text-center text-[#A1A1AA] font-medium text-sm border-t border-white/5"
                      >
                        No open orders — be the first to list energy!
                      </td>
                    </tr>
                  ) : (
                    <>
                      {asks.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-white/5 transition-colors group border-b border-white/5"
                        >
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                              ASK
                            </span>
                          </td>
                          <td className="px-6 py-3 text-red-400 font-semibold">
                            {parseFloat(row.price).toFixed(3)}
                          </td>
                          <td className="px-6 py-3 text-[#A1A1AA]">
                            {parseFloat(row.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-3 text-[#A1A1AA] text-right">
                            {parseFloat(row.total).toFixed(2)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                setSide("buy");
                                setPrice(row.price.toString());
                                setAmount(row.amount.toString());
                              }}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-md uppercase transition-all bg-white/10 text-white hover:bg-white hover:text-black hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] shadow-inner"
                            >
                              Buy
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Spread divider */}
                      {asks.length > 0 && bids.length > 0 && (
                        <tr className="bg-white/[0.02]">
                          <td
                            colSpan={5}
                            className="py-2.5 text-center text-[10px] text-white/40 font-semibold uppercase tracking-widest border-y border-white/5"
                          >
                            — Spread —
                          </td>
                        </tr>
                      )}

                      {bids.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-white/5 transition-colors group border-b border-white/5"
                        >
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              BID
                            </span>
                          </td>
                          <td className="px-6 py-3 text-emerald-400 font-semibold">
                            {parseFloat(row.price).toFixed(3)}
                          </td>
                          <td className="px-6 py-3 text-[#A1A1AA]">
                            {parseFloat(row.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-3 text-[#A1A1AA] text-right">
                            {parseFloat(row.total).toFixed(2)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                setSide("sell");
                                setPrice(row.price.toString());
                                setAmount(row.amount.toString());
                              }}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-md uppercase transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                            >
                              Sell
                            </button>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* My Recent Trades */}
          {myTrades.length > 0 && (
            <div className="skeuo-card rounded-2xl overflow-hidden border border-white/10 mt-2">
              <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-lg font-semibold text-white uppercase flex items-center gap-2 tracking-wide">
                  <span className="material-symbols-outlined !text-[20px] text-white/60">
                    history
                  </span>
                  My Trades
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono text-white/90">
                  <thead>
                    <tr className="text-[10px] text-[#A1A1AA] font-semibold uppercase border-b border-white/5 bg-black/20 tracking-wider">
                      <th className="px-6 py-3 text-left">Type</th>
                      <th className="px-6 py-3 text-left">Amount</th>
                      <th className="px-6 py-3 text-left">Price</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTrades.map((t) => {
                      const isBuyer = t.buyer === user?.wallet_address;
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                isBuyer
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}
                            >
                              {isBuyer ? "Buy" : "Sell"}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-semibold">
                            {parseFloat(t.amount).toFixed(2)} Units
                          </td>
                          <td className="px-6 py-3 text-[#A1A1AA]">
                            {parseFloat(t.price).toFixed(3)}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold">
                            {parseFloat(t.total).toFixed(2)} USDC
                          </td>
                          <td className="px-6 py-3 text-right text-white/40 text-[11px]">
                            {new Date(t.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Nearby Sellers */}
          <div className="skeuo-card rounded-2xl overflow-hidden border border-white/10 mt-6">
            <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-lg font-semibold text-white uppercase flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined !text-[20px] text-emerald-400">
                  radar
                </span>
                Nearby Sellers
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono text-white/90">
                <thead>
                  <tr className="text-[10px] text-[#A1A1AA] font-semibold uppercase border-b border-white/5 bg-black/20 tracking-wider">
                    <th className="px-6 py-3 text-left">Seller ID</th>
                    <th className="px-6 py-3 text-left">Distance</th>
                    <th className="px-6 py-3 text-left">Power Type</th>
                    <th className="px-6 py-3 text-right">Available</th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      id: "0x7F2...39A",
                      dist: "1.2 km",
                      type: "Solar",
                      avail: "4,500",
                    },
                    {
                      id: "0x99B...12C",
                      dist: "3.4 km",
                      type: "Wind",
                      avail: "12,000",
                    },
                    {
                      id: "0x3A1...88F",
                      dist: "5.1 km",
                      type: "Biogas",
                      avail: "8,200",
                    },
                  ].map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-3 font-semibold text-emerald-400">
                        {s.id}
                      </td>
                      <td className="px-6 py-3 text-[#A1A1AA]">{s.dist}</td>
                      <td className="px-6 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white border border-white/20">
                          {s.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold">
                        {s.avail} Units
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button className="text-[10px] font-bold px-3 py-1.5 rounded-md uppercase transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white">
                          Connect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Terminal / Order Form */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="skeuo-card rounded-2xl overflow-hidden border border-white/10 sticky top-28 shadow-2xl flex flex-col h-full max-h-[800px]">
            <div className="bg-[#111] px-6 py-5 flex items-center justify-between border-b border-white/5">
              <h3 className="text-lg font-semibold text-white uppercase flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined !text-[20px] text-emerald-400">
                  terminal
                </span>
                Trade Terminal
              </h3>
              <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]" />
                <span className="text-[10px] text-white/70 font-mono uppercase font-semibold">
                  Testnet
                </span>
              </div>
            </div>

            <div className="p-6 flex-grow flex flex-col bg-[#0A0A0A]">
              {/* Buy/Sell toggle */}
              <div className="flex rounded-xl bg-black border border-white/10 p-1 mb-8">
                {["buy", "sell"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-lg ${
                      side === s
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-[#A1A1AA] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {s === "buy" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>

              <div className="space-y-6 flex-grow flex flex-col">
                {/* Order type */}
                <div className="flex gap-6 border-b border-white/10 pb-4">
                  {["Limit", "Market"].map((t, i) => (
                    <label
                      key={t}
                      className={`flex items-center gap-2 cursor-pointer group ${i === 1 ? "opacity-50 hover:opacity-100" : ""}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border border-white/30 flex items-center justify-center transition-colors ${i === 0 ? "bg-white/20 border-white/50" : ""}`}
                        onClick={() =>
                          setOrderType(i === 0 ? "limit" : "market")
                        }
                      >
                        {i === 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider group-hover:text-white transition-colors">
                        {t}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Price input */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[10px] font-semibold uppercase text-[#A1A1AA] tracking-widest">
                      Price
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-[#111] border border-white/10 rounded-xl text-white p-4 font-mono text-xl focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder-white/20 transition-all shadow-inner"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/50 bg-white/5 rounded px-2 py-1 uppercase tracking-wider group-focus-within:text-white/80 transition-colors">
                      USDC
                    </span>
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[10px] font-semibold uppercase text-[#A1A1AA] tracking-widest">
                      Amount
                    </label>
                    <span className="text-[10px] font-mono text-white/40">
                      Max: {balance.toLocaleString()} FAL
                    </span>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#111] border border-white/10 rounded-xl text-white p-4 font-mono text-xl focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder-white/20 transition-all shadow-inner"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/50 bg-white/5 rounded px-2 py-1 uppercase tracking-wider group-focus-within:text-white/80 transition-colors">
                      FAL
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {["25%", "50%", "75%", "Max"].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          if (!price || balance <= 0) return;

                          let pct = 0;
                          if (p === "25%") pct = 0.25;
                          if (p === "50%") pct = 0.5;
                          if (p === "75%") pct = 0.75;
                          if (p === "Max") pct = 1;

                          if (side === "buy")
                            setAmount(
                              (
                                (balance * pct) /
                                parseFloat(price || 1)
                              ).toFixed(2),
                            );
                          else setAmount((balance * pct).toFixed(2));
                        }}
                        className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/70 hover:text-white py-1.5 font-semibold transition-colors border border-white/5"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] mt-auto">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-[#A1A1AA] font-semibold uppercase tracking-wider">
                      Est. Total
                    </span>
                    <span className="text-lg font-bold text-white font-mono">
                      {amount && price
                        ? `${(parseFloat(amount || 0) * parseFloat(price || 0)).toFixed(2)}`
                        : "0.00"}{" "}
                      <span className="text-[10px] text-white/50 font-sans tracking-wide">
                        USDC
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <span className="text-[10px] text-[#A1A1AA] font-semibold uppercase tracking-wider">
                      Network Fee
                    </span>
                    <span className="text-[11px] text-white/50 font-mono">
                      {amount && price
                        ? `${(parseFloat(amount || 0) * parseFloat(price || 0) * 0.001).toFixed(4)} USDC`
                        : "0.0000 USDC"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleExecute}
                  disabled={submitting}
                  className={`w-full skeuo-button mt-4 rounded-xl font-bold uppercase tracking-widest text-[13px] py-4 transition-all flex items-center justify-center gap-2 ${
                    submitting
                      ? "opacity-50 cursor-not-allowed"
                      : "text-white hover:text-white"
                  }`}
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined !text-[18px] animate-spin">
                        progress_activity
                      </span>
                      Processing
                    </>
                  ) : (
                    <>
                      <span>Place {side === "buy" ? "Buy" : "Sell"} Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
