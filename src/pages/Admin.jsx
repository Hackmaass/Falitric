// Admin Grid Controller — admin-only, with real Google Maps + polygon zone drawing
import { useEffect, useRef, useState } from "react";
import { database, ref, push, onValue, get, update, set } from "../firebase";
import MapComponent from "../components/Map";

// Verification proposal categories are fetched from Firebase

// Stats are now calculated dynamically inside the component

export default function Admin({ user }) {
  const [proposals, setProposals] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [activity, setActivity] = useState([]);
  const [zones, setZones] = useState([]);
  const [energyData, setEnergyData] = useState([]);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { handleConfirm, title, msg }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const walletKey = (addr) =>
    addr?.toLowerCase().replace(/[.#$[\]]/g, "_") || "";

  // ── Load energy statistics ──────────────────────────
  useEffect(() => {
    fetch("/energy_data.json")
      .then((res) => res.json())
      .then((data) => setEnergyData(data))
      .catch((err) => console.error("Failed to load energy data", err));
  }, []);

  // ── Load activity from Firebase ──────────────────────
  useEffect(() => {
    const unsub = onValue(ref(database, "faltric_trades"), (snap) => {
      if (snap.exists()) {
        const all = Object.entries(snap.val())
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);
        setActivity(all);
      }
    });
    return () => unsub();
  }, []);

  // ── Load zones from Firebase ─────────────────────────
  useEffect(() => {
    const unsubZones = onValue(ref(database, "faltric_polygons"), (snap) => {
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
        setZones(all);
      } else {
        setZones([]);
      }
    });

    const unsubProps = onValue(ref(database, "faltric_proposals"), (snap) => {
      if (snap.exists()) {
        const all = Object.entries(snap.val())
          .map(([id, v]) => ({ id, ...v }))
          .filter((p) => p.status === "pending");
        setProposals(all);
      } else {
        setProposals([]);
      }
    });

    return () => {
      unsubZones();
      unsubProps();
    };
  }, []);

  const handlePolygonDrawn = (coords) => {
    const id = Date.now().toString();
    set(ref(database, `faltric_polygons/${id}`), {
      id,
      coordinates: coords,
      name: `Admin Zone ${id.slice(-4)}`,
      type: "Solar", // default
      createdBy: user?.email || "admin",
      createdAt: Date.now(),
      status: "active",
    }).then(() => {
      setDrawMode(false);
      showToast("Zone created successfully!");
    });
  };

  // ── Toggle draw mode ──────────────────────────────────
  const toggleDraw = () => {
    setDrawMode(!drawMode);
  };

  const handleApprove = async (prop) => {
    try {
      if (!prop.wallet_address) {
        showToast("Error: No wallet address in proposal", "error");
        return;
      }
      const uKey = walletKey(prop.wallet_address);
      const userRef = ref(database, `faltric_users/${uKey}`);
      const userSnap = await get(userRef);

      const currentBalance =
        (userSnap.exists() ? userSnap.val().token_balance : 0) || 0;
      const currentUnits =
        (userSnap.exists() ? userSnap.val().current_units : 0) || 0;
      const reward = parseFloat(prop.capacity || 0);

      // 1. Update user balance & units
      await update(userRef, {
        token_balance: currentBalance + reward,
        current_units: currentUnits + reward, // Also 1:1 units
      });

      // 2. Make polygon live
      await set(ref(database, `faltric_polygons/${prop.id}`), {
        ...prop,
        status: "active",
        approvedBy: user?.email,
        approvedAt: Date.now(),
      });

      // 3. Mark proposal as approved
      await update(ref(database, `faltric_proposals/${prop.id}`), {
        status: "approved",
      });

      showToast(`Approved! Issued ${reward} FAL to ${prop.createdBy}`);
    } catch (err) {
      console.error("Approval failed", err);
      showToast("Error approving proposal", "error");
    }
  };

  const handleReject = async (propId) => {
    setConfirmModal({
      title: "Reject Proposal",
      msg: "Are you sure you want to reject this energy node proposal?",
      handleConfirm: async () => {
        try {
          await update(ref(database, `faltric_proposals/${propId}`), {
            status: "rejected",
          });
          showToast("Proposal rejected", "success");
        } catch (err) {
          showToast("Rejection failed", "error");
        }
        setConfirmModal(null);
      },
    });
  };

  // ── Stats Calculation ──────────────────────────────
  const stats = [
    {
      label: "Total Output",
      value: `${zones.reduce((sum, z) => sum + parseFloat(z.offset || 0), 0).toLocaleString()} FAL`,
    },
    { label: "Active Zones", value: zones.length.toString() },
    {
      label: "Carbon Offset",
      value: `${(zones.reduce((sum, z) => sum + parseFloat(z.offset || 0), 0) * 0.85).toFixed(1)} T`,
    },
    { label: "Pending", value: `${proposals.length} Nodes`, dark: true },
  ];

  return (
    <div className="flex flex-col p-4 md:p-6 pt-36 md:pt-40 gap-8 min-h-screen bg-[#f0f9f6]">
      {toast && (
        <div
          className={`fixed top-24 right-6 z-[100] px-6 py-4 rounded-xl font-bold text-sm shadow-2xl border transition-all animate-in slide-in-from-right-10 ${
            toast.type === "error"
              ? "bg-red-500 text-white border-black"
              : "bg-[#059669] text-white border-black"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000] p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-xl font-black uppercase tracking-tight">
              {confirmModal.title}
            </h3>
            <p className="text-sm font-bold text-gray-600 font-mono">
              {confirmModal.msg}
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmModal.handleConfirm}
                className="flex-1 h-12 bg-red-500 text-white font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 h-12 bg-white text-black font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#888] active:translate-y-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#059669] mb-2">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "14px" }}
            >
              admin_panel_settings
            </span>
            <span>Admin</span>
            <span>/</span>
            <span className="bg-[#d1fae5] px-1 border border-[#059669]">
              Grid Management
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">
            Grid Controller
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="size-3 bg-[#059669] rounded-full border border-black animate-pulse" />
          <span className="text-xs font-mono font-bold">SYSTEM ONLINE</span>
          <span className="px-2 py-1 bg-[#022c22] text-[#10b981] text-[10px] font-black uppercase border-2 border-[#064e3b]">
            ADMIN MODE
          </span>
        </div>
      </div>

      {/* Stats Section - Full Width at Top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, dark }) => (
          <div
            key={label}
            className={`p-5 border-4 border-black shadow-[6px_6px_0px_0px_${dark ? "#064e3b" : "#000"}] flex flex-col justify-between min-h-[100px] transition-transform hover:-translate-y-1 ${dark ? "bg-[#022c22] text-white" : "bg-white text-black"}`}
          >
            <span
              className={`text-[10px] font-black uppercase tracking-[0.2em] ${dark ? "text-[#10b981]" : "text-gray-500"}`}
            >
              {label}
            </span>
            <span className="text-3xl font-black tracking-tighter">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 ">
        {/* Map */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="relative w-full h-[520px] border-4 border-black shadow-[8px_8px_0px_0px_#064e3b] overflow-hidden group">
            <div className=" saturate-125 contrast-125 opacity-100 absolute inset-0 z-0 h-full w-full pointer-events-auto bg-gray-100">
              <MapComponent
                user={user}
                drawingModeEnabled={drawMode}
                onPolygonDrawn={handlePolygonDrawn}
                energyData={energyData}
              />
            </div>

            {/* Zone tool overlay */}
            <div className="absolute top-4 left-4 z-10 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#064e3b] p-4 w-60 pointer-events-auto">
              <h3 className="font-black uppercase text-sm border-b-2 border-black pb-1 mb-3 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[#059669]"
                  style={{ fontSize: "16px" }}
                >
                  draw
                </span>
                Zone Definition
              </h3>
              <p className="text-gray-600 text-xs font-mono mb-3 leading-tight">
                Draw polygons on the map to define P2P trading zones.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleDraw}
                  className={`flex items-center justify-center gap-1.5 h-10 border-2 border-black text-xs font-bold uppercase transition-all ${
                    drawMode
                      ? "bg-[#059669] text-white shadow-none translate-x-[1px] translate-y-[1px]"
                      : "bg-black text-white shadow-[2px_2px_0px_0px_#064e3b] hover:bg-[#059669]"
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    {drawMode ? "stop_circle" : "draw"}
                  </span>
                  {drawMode ? "Stop" : "Draw"}
                </button>
                <button
                  onClick={() => setDrawMode(false)}
                  className="flex items-center justify-center gap-1.5 h-10 border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_#888] hover:bg-gray-100 text-xs font-bold uppercase transition-all"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    edit
                  </span>
                  Edit
                </button>
              </div>
              {drawMode && (
                <div className="flex items-center gap-2 mt-3 bg-[#d1fae5] p-2 border border-[#059669]">
                  <div className="size-2 rounded-full bg-[#059669] animate-pulse" />
                  <span className="text-[10px] font-mono font-bold uppercase text-[#022c22]">
                    Click map to draw zone
                  </span>
                </div>
              )}
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#059669]">
                {zones.length} zones active
              </div>
            </div>
          </div>
        </div>

        {/* Verifications panel */}
        <div className="lg:col-span-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#064e3b] flex flex-col h-full max-h-[520px]">
            <div className="p-5 border-b-4 border-black flex justify-between items-center bg-[#f0f9f6]">
              <h3 className="font-black text-xl uppercase tracking-tight">
                Verifications
              </h3>
              <span className="bg-[#059669] text-white text-xs font-bold px-2 py-1 border border-[#064e3b]">
                {proposals.length} NEW
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <span className="material-symbols-outlined text-4xl mb-2">
                    verified
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Queue Empty
                  </p>
                </div>
              ) : (
                proposals.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 bg-[#f0f9f6] border-2 border-black shadow-[4px_4px_0px_0px_#064e3b] flex flex-col gap-4 hover:bg-white transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="size-10 bg-[#d1fae5] border-2 border-black flex items-center justify-center shrink-0">
                          <span
                            className="material-symbols-outlined text-[#064e3b]"
                            style={{ fontSize: "20px" }}
                          >
                            {v.type === "Solar"
                              ? "solar_power"
                              : v.type === "Wind"
                                ? "air"
                                : v.type === "Biogas"
                                  ? "energy_program_saving"
                                  : "bolt"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm uppercase truncate">
                            {v.name}
                          </h4>
                          <p className="text-[10px] text-gray-500 font-mono truncate">
                            {v.createdBy}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs font-black text-[#059669]">
                            {v.offset} FAL
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(v)}
                        className="flex-1 h-9 bg-[#059669] hover:bg-[#064e3b] text-white text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#022c22] active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(v.id)}
                        className="flex-1 h-9 bg-white hover:bg-gray-100 text-black text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t-4 border-black bg-[#f0f9f6]">
              <button className="w-full h-10 flex items-center justify-center text-[10px] font-black uppercase border-2 border-dashed border-[#059669] text-[#059669] hover:bg-[#059669] hover:text-white hover:border-solid transition-colors">
                View all verifications
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity from Firebase */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-2xl font-black uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-[#059669]">
              history
            </span>
            Recent Activity
          </h3>
          <div className="h-1 flex-1 bg-[#059669]" />
          <span className="text-xs font-mono text-gray-500">
            Live from Firebase
          </span>
        </div>
        <div className="overflow-x-auto border-4 border-black shadow-[6px_6px_0px_0px_#064e3b]">
          <table className="w-full text-left text-sm bg-white">
            <thead className="bg-[#022c22] text-[#10b981] text-xs uppercase font-bold tracking-wider">
              <tr>
                {[
                  "Type",
                  "Buyer",
                  "Seller",
                  "Amount (kWh)",
                  "Price",
                  "Total (USDC)",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 border-r border-[#064e3b] last:border-r-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black font-medium font-mono">
              {activity.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-400 font-bold uppercase text-xs tracking-widest"
                  >
                    No P2P trades yet — go to Exchange to start trading!
                  </td>
                </tr>
              ) : (
                activity.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-[#f0f9f6] transition-colors"
                  >
                    <td className="px-6 py-4 border-r-2 border-black">
                      <span className="flex items-center gap-2">
                        <span
                          className="material-symbols-outlined text-[#059669]"
                          style={{ fontSize: "16px" }}
                        >
                          bolt
                        </span>
                        {r.type || "P2P Energy Sale"}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black text-xs text-gray-500">
                      {r.buyer ? `${r.buyer.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black text-xs text-gray-500">
                      {r.seller ? `${r.seller.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black font-bold">
                      {parseFloat(r.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black">
                      {parseFloat(r.price || 0).toFixed(3)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[#064e3b]">
                      {parseFloat(r.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="text-center py-8 text-xs font-mono text-[#059669] border-t-2 border-dashed border-[#10b981]">
        FALTRIC ADMIN SYSTEM v3.0 • MODERN DARKGREEN MODE • {user?.email}
      </footer>
    </div>
  );
}
