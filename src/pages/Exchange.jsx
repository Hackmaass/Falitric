// Exchange — Faltric P2P Energy Exchange with Firebase backend
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { database, ref, onValue, get, push, update } from "../firebase";
import {
  ComposedChart,
  AreaChart,
  Area,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

const walletKey = (addr) => addr?.toLowerCase().replace(/[.#$[\]]/g, "_") || "";

// --- Sub-components (Memoized to isolate re-renders) ---

const MarketChart = memo(
  ({ chartData, livePrice, timeRange, setTimeRange }) => {
    const firstPrice = chartData[0]?.close || 0;
    const lastPrice = chartData[chartData.length - 1]?.close || livePrice || 0;
    const isPositive = lastPrice >= firstPrice;
    const pctChange =
      firstPrice !== 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    return (
      <div className="w-full h-[500px] rounded-2xl border border-white/10 relative overflow-hidden bg-[#0A0A0A] shadow-inner flex flex-col">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay pointer-events-none"></div>

        <div className="p-6 flex justify-between items-start relative z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full animate-[pulse_2s_infinite] ${isPositive ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <span className="text-[10px] font-bold tracking-widest text-[#A1A1AA] uppercase">
                ETH / USDC Live Market ({timeRange})
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-white font-mono">
                ${livePrice ? parseFloat(livePrice).toLocaleString() : "..."}
              </h2>
              <span
                className={`text-xs font-semibold font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}
              >
                {pctChange >= 0 ? "+" : ""}
                {pctChange.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {["1m", "1h", "1y"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${timeRange === t ? "bg-white/10 border-white/20 text-white" : "border-transparent text-[#A1A1AA] hover:text-white"}`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-grow w-full min-h-[400px] relative px-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 0, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#ffffff05"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#71717a", fontSize: 10 }}
                minTickGap={40}
              />
              <YAxis
                yAxisId="price"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#71717a",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
                domain={["auto", "auto"]}
                mirror={true}
              />
              <YAxis
                yAxisId="volume"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tick={false}
                domain={[0, (dataMax) => dataMax * 4]} // Volume at bottom
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isUp = data.close >= data.open;
                    return (
                      <div className="bg-[#0A0A0A]/95 border border-white/10 p-4 rounded-xl backdrop-blur-xl shadow-2xl font-mono ring-1 ring-white/10 min-w-[180px]">
                        <p className="text-[10px] text-[#A1A1AA] mb-3 border-b border-white/5 pb-2 flex justify-between uppercase tracking-widest font-bold">
                          <span>{data.time}</span>
                          <span
                            className={
                              isUp ? "text-emerald-400" : "text-red-400"
                            }
                          >
                            {isUp ? "Buying Vol" : "Selling Vol"}
                          </span>
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#A1A1AA]">PRICE</span>
                            <span className="text-white font-bold font-mono">
                              $
                              {data.close?.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#A1A1AA]">VOLUME</span>
                            <span
                              className={
                                isUp
                                  ? "text-emerald-400 font-bold"
                                  : "text-red-400 font-bold"
                              }
                            >
                              {data.volume?.toLocaleString()} ETH
                            </span>
                          </div>
                          <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-[#A1A1AA]">
                                O
                              </span>
                              <span className="text-[10px] text-white/80">
                                ${data.open?.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-[#A1A1AA]">
                                H
                              </span>
                              <span className="text-[10px] text-emerald-400/80">
                                ${data.high?.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Volume Bars */}
              <Bar
                yAxisId="volume"
                dataKey="volume"
                radius={[2, 2, 0, 0]}
                barSize={12}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.close >= entry.open ? "#10b98166" : "#ef444466"}
                  />
                ))}
              </Bar>

              {/* Price Line (Primary) */}
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorPrice)"
                dot={false}
                animationDuration={1000}
              />

              {/* Technical Indicators */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma7"
                stroke="#f59e0b"
                strokeWidth={1}
                dot={false}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  },
);

const OrderBook = memo(({ orders, asks, bids, onAction }) => (
  <div className="skeuo-card rounded-2xl overflow-hidden border border-white/10 flex flex-col flex-1 max-h-[500px]">
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

    <div className="overflow-y-auto flex-1 scrollbar-hide">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#0A0A0A] z-10">
          <tr className="text-[10px] uppercase text-[#A1A1AA] font-semibold border-b border-white/5 bg-black/20 tracking-wider">
            <th className="px-6 py-4 font-mono">Side</th>
            <th className="px-6 py-4 font-mono">Price (FAL)</th>
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
                      onClick={() => onAction("buy", row.price, row.amount)}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-md uppercase transition-all bg-white/10 text-white hover:bg-white hover:text-black hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] shadow-inner"
                    >
                      Buy
                    </button>
                  </td>
                </tr>
              ))}
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
                      onClick={() => onAction("sell", row.price, row.amount)}
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
));

const MyTrades = memo(({ myTrades, user }) => {
  if (myTrades.length === 0) return null;
  return (
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
                    {parseFloat(t.total).toFixed(2)} FAL
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
  );
});

const NearbySellers = memo(({ dynamicSellers, onAction }) => (
  <div className="skeuo-card rounded-2xl overflow-hidden border border-white/10 mt-6">
    <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02]">
      <h3 className="text-lg font-semibold text-white uppercase flex items-center gap-2 tracking-wide">
        <span className="material-symbols-outlined !text-[20px] text-emerald-400">
          radar
        </span>
        Nearby Sellers (Live Grid)
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
          {dynamicSellers.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-[#A1A1AA] font-medium text-sm border-t border-white/5"
              >
                No sellers nearby right now.
              </td>
            </tr>
          ) : (
            dynamicSellers.map((s, i) => (
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
                  <button
                    onClick={() =>
                      onAction(
                        "buy",
                        s.rawOrder.price.toString(),
                        s.rawOrder.amount.toString(),
                      )
                    }
                    className="text-[10px] font-bold px-3 py-1.5 rounded-md uppercase transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                  >
                    Connect
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
));

const TradeTerminal = memo(
  ({
    side,
    setSide,
    price,
    setPrice,
    amount,
    setAmount,
    orderType,
    setOrderType,
    balance,
    unitsBalance,
    submitting,
    handleExecute,
  }) => (
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
          <div className="flex gap-6 border-b border-white/10 pb-4">
            {["Limit", "Market"].map((t, i) => (
              <label
                key={t}
                className={`flex items-center gap-2 cursor-pointer group ${i === 1 ? "opacity-50 hover:opacity-100" : ""}`}
              >
                <div
                  className={`w-4 h-4 rounded-full border border-white/30 flex items-center justify-center transition-colors ${orderType === (i === 0 ? "limit" : "market") ? "bg-white/20 border-white/50" : ""}`}
                  onClick={() => setOrderType(i === 0 ? "limit" : "market")}
                >
                  {orderType === (i === 0 ? "limit" : "market") && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider group-hover:text-white transition-colors">
                  {t}
                </span>
              </label>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase text-[#A1A1AA] tracking-widest block mb-2">
              Price
            </label>
            <div className="relative group">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl text-white p-4 font-mono text-xl focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder-white/20 transition-all shadow-inner"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/50 bg-white/5 rounded px-2 py-1 uppercase tracking-wider group-focus-within:text-white/80 transition-colors">
                FAL
              </span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-[10px] font-semibold uppercase text-[#A1A1AA] tracking-widest">
                Amount (Units)
              </label>
              <span className="text-[10px] font-mono text-white/40">
                Avail:{" "}
                {side === "buy"
                  ? `${balance.toLocaleString()} FAL`
                  : `${unitsBalance.toLocaleString()} Units`}
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
                Units
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              {["25%", "50%", "75%", "Max"].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const pct =
                      p === "25%"
                        ? 0.25
                        : p === "50%"
                          ? 0.5
                          : p === "75%"
                            ? 0.75
                            : 1;
                    if (side === "buy") {
                      if (!price || parseFloat(price) <= 0) return;
                      setAmount(
                        ((balance * pct) / parseFloat(price)).toFixed(2),
                      );
                    } else {
                      setAmount((unitsBalance * pct).toFixed(2));
                    }
                  }}
                  className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/70 hover:text-white py-1.5 font-semibold transition-colors border border-white/5"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] mt-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] text-[#A1A1AA] font-semibold uppercase tracking-wider">
                Est. Total Cost
              </span>
              <span className="text-lg font-bold text-white font-mono">
                {amount && price
                  ? `${(parseFloat(amount || 0) * parseFloat(price || 0)).toFixed(2)}`
                  : "0.00"}{" "}
                <span className="text-[10px] text-white/50 font-sans tracking-wide">
                  FAL
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-white/5">
              <span className="text-[10px] text-[#A1A1AA] font-semibold uppercase tracking-wider">
                Estimated Units
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                {amount
                  ? `${parseFloat(amount).toLocaleString()} kWh`
                  : "0 kWh"}
              </span>
            </div>
          </div>

          <button
            onClick={handleExecute}
            disabled={submitting}
            className={`w-full skeuo-button mt-4 rounded-xl font-bold uppercase tracking-widest text-[13px] py-4 transition-all flex items-center justify-center gap-2 ${
              submitting ? "opacity-50 cursor-not-allowed" : "text-white"
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
              <span>Place {side === "buy" ? "Buy" : "Sell"} Order</span>
            )}
          </button>
        </div>
      </div>
    </div>
  ),
);

// --- Main Component ---

export default function Exchange({ user }) {
  const [side, setSide] = useState("buy");
  const [price, setPrice] = useState("0.0025");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState("limit");
  const [orders, setOrders] = useState([]);
  const [myTrades, setMyTrades] = useState([]);
  const [balance, setBalance] = useState(user?.token_balance ?? 0);
  const [unitsBalance, setUnitsBalance] = useState(user?.current_units ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const [allUsers, setAllUsers] = useState({});
  const [chartHistory, setChartHistory] = useState([]);
  const [timeRange, setTimeRange] = useState("1m");

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch Live ETH Price & Build History
  useEffect(() => {
    const apiKey =
      import.meta.env.VITE_ETHERSCAN_API_KEY ||
      "C566HAWXGYB5CETUFD7QKI9YKMDU37HBEZ";
    if (!apiKey) {
      console.warn("Etherscan API key missing");
      return;
    }

    // 1m and 1h: Real-time update via polling
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethprice&apikey=${apiKey}`,
        );
        const data = await res.json();

        if (data.status === "1" && data.result?.ethusd) {
          const newPrice = parseFloat(data.result.ethusd);
          setLivePrice(newPrice);

          setChartHistory((prev) => {
            let next = [...prev];
            const now = new Date();
            const timeStr =
              timeRange === "1y"
                ? now.toLocaleDateString([], { month: "short", day: "numeric" })
                : now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

            if (next.length === 0 && timeRange !== "1y") {
              // Seed for 1m/1h if absolutely empty
              for (let i = 40; i > 0; i--) {
                const d = new Date(Date.now() - i * 60000);
                const base = newPrice * (0.995 + Math.random() * 0.01);
                next.push({
                  time: d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  open: base,
                  high: base * (1 + Math.random() * 0.002),
                  low: base * (1 - Math.random() * 0.002),
                  close: base * (0.999 + Math.random() * 0.002),
                  volume: Math.floor(Math.random() * 500) + 100,
                });
              }
            }

            if (next.length === 0) return next;

            const last = next[next.length - 1];
            if (last && last.time === timeStr) {
              next[next.length - 1] = {
                ...last,
                close: newPrice,
                high: Math.max(last.high || newPrice, newPrice),
                low: Math.min(last.low || newPrice, newPrice),
                volume: (last.volume || 0) + Math.floor(Math.random() * 10),
              };
            } else {
              const open = last ? last.close : newPrice;
              next.push({
                time: timeStr,
                open,
                high: Math.max(open, newPrice),
                low: Math.min(open, newPrice),
                close: newPrice,
                volume: Math.floor(Math.random() * 200) + 50,
              });
              const limit =
                timeRange === "1y" ? 366 : timeRange === "1m" ? 40 : 120;
              next = next.slice(-limit);
            }

            return next.map((p, idx, arr) => {
              const calcMA = (period) => {
                const startIdx = idx - period + 1;
                if (startIdx < 0) return null;
                let sum = 0;
                for (let i = startIdx; i <= idx; i++) {
                  sum += arr[i].close || arr[i].open || 0;
                }
                return sum / period;
              };
              return { ...p, ma7: calcMA(7), ma25: calcMA(25) };
            });
          });
        }
      } catch (err) {
        console.warn("Pricing failed", err);
      }
    };

    // 1y: Fetch historical daily data
    const fetchYearlyHistory = async () => {
      try {
        const res = await fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethdailyprice&apikey=${apiKey}`,
        );
        const data = await res.json();
        if (data.status === "1" && data.result) {
          const formatted = data.result.slice(-365).map((item) => {
            const p = parseFloat(item.ethusd);
            return {
              time: new Date(item.unixTimeStamp * 1000).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              }),
              open: p,
              high: p,
              low: p,
              close: p,
            };
          });
          setChartHistory(formatted);
        }
      } catch (err) {
        console.warn("Etherscan history failed:", err);
      }
    };

    if (timeRange === "1y") {
      fetchYearlyHistory();
    } else if (chartHistory.length === 0) {
      // Seed if empty for 1m/1h
      fetchPrice();
    }

    const interval = setInterval(fetchPrice, 5000); // RELENTLESS 5s Updates
    return () => clearInterval(interval);
  }, [timeRange]);

  // Fetch All Users for Geolocation discovery
  useEffect(() => {
    const unsub = onValue(ref(database, "faltric_users"), (snap) => {
      if (snap.exists()) setAllUsers(snap.val());
    });
    return () => unsub();
  }, []);

  const calculateDistance = (loc1, loc2) => {
    if (!loc1 || !loc2) return (Math.random() * 5 + 0.5).toFixed(1) + " km"; // Random fallback if loc missing
    const R = 6371; // km
    const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const dLon = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.lat * Math.PI) / 180) *
        Math.cos((loc2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1) + " km";
  };

  const dynamicSellers = useMemo(() => {
    const sellersMap = [];
    const openSellOrders = orders.filter(
      (o) =>
        o.side === "sell" &&
        o.status === "open" &&
        o.wallet !== user?.wallet_address,
    );

    openSellOrders.forEach((o) => {
      const uKey = walletKey(o.wallet);
      const sellerData = allUsers[uKey];
      sellersMap.push({
        id:
          o.wallet.substring(0, 6) +
          "..." +
          o.wallet.substring(o.wallet.length - 4),
        dist: calculateDistance(
          user?.last_login_location,
          sellerData?.last_login_location,
        ),
        type: "Solar/Wind",
        avail: o.amount.toLocaleString(),
        rawOrder: o,
      });
    });

    return sellersMap.slice(0, 5);
  }, [orders, allUsers, user?.wallet_address, user?.last_login_location]);

  // Clear the static mock data effect

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

  // Removed static chart interval

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

  useEffect(() => {
    if (!user?.wallet_address) return;
    const uKey = walletKey(user.wallet_address);
    const unsub = onValue(ref(database, `faltric_users/${uKey}`), (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setBalance(d.token_balance ?? 0);
        setUnitsBalance(d.current_units ?? 0);
      }
    });
    return () => unsub();
  }, [user?.wallet_address]);

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

    if (side === "buy" && balance < total)
      return showToast("Insufficient FAL balance", "error");
    if (side === "sell" && unitsBalance < qty)
      return showToast("Insufficient Energy Units", "error");

    setSubmitting(true);
    try {
      const opposites = orders.filter(
        (o) =>
          o.side !== side &&
          o.wallet !== user.wallet_address &&
          parseFloat(o.amount) >= qty &&
          (side === "buy"
            ? parseFloat(o.price) <= px
            : parseFloat(o.price) >= px),
      );

      if (opposites.length > 0) {
        // MATCH FOUND
        const match = opposites[side === "buy" ? opposites.length - 1 : 0];
        const matchTotal = qty * parseFloat(match.price);
        const makerKey = walletKey(match.wallet);
        const takerKey = walletKey(user.wallet_address);

        // Fetch makers and takers again for atomic-ish check
        const makerSnap = await get(ref(database, `faltric_users/${makerKey}`));
        const takerSnap = await get(ref(database, `faltric_users/${takerKey}`));

        const maker = makerSnap.val();
        const taker = takerSnap.val();

        if (side === "buy") {
          // Taker is Buyer, Maker is Seller
          await update(ref(database, `faltric_users/${takerKey}`), {
            token_balance: (taker.token_balance || 0) - matchTotal,
            current_units: (taker.current_units || 0) + qty,
          });
          await update(ref(database, `faltric_users/${makerKey}`), {
            token_balance: (maker.token_balance || 0) + matchTotal,
            current_units: (maker.current_units || 0) - qty,
          });
        } else {
          // Taker is Seller, Maker is Buyer
          await update(ref(database, `faltric_users/${takerKey}`), {
            token_balance: (taker.token_balance || 0) + matchTotal,
            current_units: (taker.current_units || 0) - qty,
          });
          await update(ref(database, `faltric_users/${makerKey}`), {
            token_balance: (maker.token_balance || 0) - matchTotal,
            current_units: (maker.current_units || 0) + qty,
          });
        }

        await update(ref(database, `faltric_orders/${match.id}`), {
          status: "filled",
        });
        await push(ref(database, "faltric_trades"), {
          buyer: side === "buy" ? user.wallet_address : match.wallet,
          seller: side === "sell" ? user.wallet_address : match.wallet,
          amount: qty,
          price: parseFloat(match.price),
          total: matchTotal,
          timestamp: Date.now(),
          type: "Grid Match Execution",
        });

        showToast(`✅ Trade Executed! ${qty} Units @ ${match.price} FAL`);
      } else {
        // PLACE OPEN ORDER
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
          `📋 Order placed: ${side.toUpperCase()} ${qty} Units @ ${px} FAL`,
        );
      }
      setAmount("");
    } catch (err) {
      showToast(err.message || "Transaction failed", "error");
    } finally {
      setSubmitting(false);
    }
  }, [side, price, amount, orders, user, balance, unitsBalance, showToast]);

  const handleFaucet = async () => {
    if (!user?.wallet_address)
      return showToast("Connect wallet first", "error");
    const uKey = walletKey(user.wallet_address);
    try {
      const snap = await get(ref(database, `faltric_users/${uKey}`));
      const data = snap.val() || {};
      await update(ref(database, `faltric_users/${uKey}`), {
        token_balance: (data.token_balance || 0) + 100,
        current_units: (data.current_units || 0) + 500,
      });
      showToast("🎁 Faucet: Received 100 FAL & 500 Units!", "success");
    } catch (err) {
      showToast("Faucet failed", "error");
    }
  };

  const onQuickAction = useCallback((newSide, newPrice, newAmount) => {
    setSide(newSide);
    setPrice(newPrice.toString());
    setAmount(newAmount.toString());
  }, []);

  const asks = useMemo(
    () => orders.filter((o) => o.side === "sell").slice(0, 15),
    [orders],
  );
  const bids = useMemo(
    () => orders.filter((o) => o.side === "buy").slice(0, 15),
    [orders],
  );

  return (
    <main className="flex-grow flex flex-col pt-32 px-4 pb-12 w-full max-w-7xl mx-auto">
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
              Decentralized Marketplace
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-white mb-2 leading-tight drop-shadow-lg">
            P2P Energy
            <br />
            <span className="text-white/40">Exchange</span>
          </h2>
          <div className="flex gap-4 mt-2">
            <button
              onClick={handleFaucet}
              className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined !text-[16px]">
                water_drop
              </span>
              Mine 100 FAL
            </button>
          </div>
        </div>
        <div className="md:col-span-5 lg:col-span-4 flex gap-4 justify-end">
          <div className="skeuo-card p-5 flex-1 rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-white/5 transition-transform group-hover:scale-110 duration-500">
              <span className="material-symbols-outlined !text-[80px]">
                account_balance_wallet
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase mb-2 relative z-10">
              Wallet Balance
            </p>
            <p className="text-2xl font-bold text-white relative z-10 font-mono tracking-tight">
              {balance.toLocaleString()}{" "}
              <span className="text-[10px] font-semibold align-top text-white/40 ml-1">
                FAL
              </span>
            </p>
            <p className="text-xs text-white/40 font-mono mt-1 relative z-10">
              {unitsBalance.toLocaleString()}{" "}
              <span className="text-[9px]">Units</span>
            </p>
            {(!user?.wallet_address || user.wallet_address === "admin") && (
              <button
                onClick={() => window.connectFaltricWallet?.()}
                className="mt-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 relative z-10"
              >
                <span className="material-symbols-outlined !text-[14px]">
                  link
                </span>
                Connect Wallet
              </button>
            )}
          </div>
          <div className="skeuo-card p-5 flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase mb-2">
              ETH Market
            </p>
            <p className="text-2xl font-bold text-white font-mono tracking-tight">
              ${livePrice ? parseFloat(livePrice).toLocaleString() : "..."}
            </p>
            <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined !text-[14px]">
                trending_up
              </span>
              Real-time
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          <MarketChart
            chartData={chartHistory}
            livePrice={livePrice}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
          />
          <OrderBook
            orders={orders}
            asks={asks}
            bids={bids}
            onAction={onQuickAction}
          />
          <MyTrades myTrades={myTrades} user={user} />
          <NearbySellers
            dynamicSellers={dynamicSellers}
            onAction={onQuickAction}
          />
        </div>

        <div className="lg:col-span-5 xl:col-span-4">
          <TradeTerminal
            side={side}
            setSide={setSide}
            price={price}
            setPrice={setPrice}
            amount={amount}
            setAmount={setAmount}
            orderType={orderType}
            setOrderType={setOrderType}
            balance={balance}
            unitsBalance={unitsBalance}
            submitting={submitting}
            handleExecute={handleExecute}
          />
        </div>
      </div>
    </main>
  );
}
