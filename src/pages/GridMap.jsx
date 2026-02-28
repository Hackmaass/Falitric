import { useState, useEffect, useMemo } from "react";
import MapComponent from "../components/Map";
import { database, ref, set } from "../firebase";

export default function GridMap({ user }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [drawingModeEnabled, setDrawingModeEnabled] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [energyData, setEnergyData] = useState([]);
  const [liveFluctuation, setLiveFluctuation] = useState(1);

  const [newPlant, setNewPlant] = useState({
    name: "",
    type: "Solar",
    capacity: "",
  });

  useEffect(() => {
    fetch("/energy_data.json")
      .then((res) => res.json())
      .then((data) => setEnergyData(data))
      .catch((err) => console.error("Failed to load energy data", err));

    // Mock live fluctuation for "Real Data" feel
    const interval = setInterval(() => {
      setLiveFluctuation(0.98 + Math.random() * 0.04);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Global Grid Metrics (Dynamic)
  const globalMetrics = useMemo(() => {
    if (energyData.length === 0)
      return { load: "...", nodes: "...", co2: "..." };

    const totalOutput = energyData.reduce((sum, d) => sum + d.output_kwh, 0);
    const totalDemand = energyData.reduce((sum, d) => sum + d.demand_kwh, 0);
    const loadPercent = Math.round((totalDemand / (totalOutput || 1)) * 100);
    const co2Saved = Math.round(totalOutput * 0.85); // 0.85kg per kWh

    return {
      load: `${loadPercent}%`,
      nodes: energyData.length.toLocaleString(),
      co2: `${(co2Saved / 1000).toFixed(1)}t`,
    };
  }, [energyData]);

  // Selected Node Data (Mocking selection of #4291 for now)
  const selectedNode = useMemo(() => {
    const node = energyData.find((d) => d.node_id === "ND-4291") || {
      output_kwh: 450,
      demand_kwh: 450,
      efficiency_ratio: 0.9,
      type: "Solar",
    };
    return {
      output: Math.round(node.output_kwh * liveFluctuation),
      demand: Math.round(node.demand_kwh * liveFluctuation),
      efficiency: (node.efficiency_ratio * 100).toFixed(1),
      type: node.type,
    };
  }, [energyData, liveFluctuation]);

  const handlePolygonDrawn = (coords) => {
    setPendingCoords(coords);
    setShowAddModal(true);
    setDrawingModeEnabled(false);
  };

  const handleAddPlant = async (e) => {
    e.preventDefault();
    if (!pendingCoords) {
      alert("Please draw a polygon on the map first!");
      return;
    }

    const id = Date.now().toString();
    const data = {
      id,
      ...newPlant,
      coordinates: pendingCoords,
      timestamp: Date.now(),
      createdBy: user?.email,
    };

    try {
      await set(ref(database, `faltric_polygons/${id}`), data);
      setShowAddModal(false);
      setNewPlant({ name: "", type: "Solar", capacity: "" });
      setPendingCoords(null);
    } catch (err) {
      console.error("Failed to save polygon", err);
      alert("Failed to save. Check console for details.");
    }
  };

  // Check if current user is admin
  const isAdmin = user?.email === "test@admin.com";

  return (
    <main
      className="flex-1 relative flex overflow-hidden bg-[#050505] pt-24"
      style={{ minHeight: "100vh" }}
    >
      {/* Actual Google Maps component fills the background */}
      <div className="absolute inset-0 z-0 h-full w-full mix-blend-screen saturate-125 contrast-125 opacity-100 pointer-events-auto">
        <MapComponent
          user={user}
          drawingModeEnabled={drawingModeEnabled}
          onPolygonDrawn={handlePolygonDrawn}
          energyData={energyData}
        />
      </div>

      {/* Left sidebar */}
      <aside className="absolute top-28 left-6 bottom-6 w-96 z-20 flex flex-col gap-6 pointer-events-none">
        {/* Search + Filter panel */}
        <div className="pointer-events-auto glass-nav rounded-2xl p-4 border border-white/10 shadow-2xl">
          <div className="relative w-full h-12 mb-4">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <span className="material-symbols-outlined text-white/50 !text-[24px]">
                search
              </span>
            </div>
            <input
              className="w-full h-full bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 pl-10 pr-4 font-medium text-sm text-white placeholder-white/30 transition-colors shadow-inner"
              placeholder="Search Nodes..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                name: "Solar",
                color: "text-amber-400 border-amber-500/30 bg-amber-500/5",
              },
              {
                name: "Wind",
                color: "text-blue-400 border-blue-500/30 bg-blue-500/5",
              },
              {
                name: "Biogas",
                color: "text-green-400 border-green-500/30 bg-green-500/5",
              },
              {
                name: "Battery",
                color: "text-purple-400 border-purple-500/30 bg-purple-500/5",
              },
            ].map((f, i) => (
              <button
                key={f.name}
                className={`flex-1 h-10 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                  i === 0
                    ? "bg-white/10 text-white border-white/20 shadow-sm"
                    : `${f.color} hover:bg-white/5`
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Node info card */}
        <div className="mt-auto pointer-events-auto skeuo-card rounded-2xl overflow-hidden flex flex-col border border-white/10 shadow-2xl">
          <div className="relative h-40 w-full bg-[#111] overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-screen"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2672&auto=format&fit=crop')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/40 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div>
                <div className="flex items-center gap-2 mb-2 px-2.5 py-1 rounded bg-black/60 backdrop-blur w-max border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Online
                  </span>
                </div>
                <h3 className="text-white text-2xl font-bold uppercase tracking-tight drop-shadow-md">
                  Node #4291
                </h3>
              </div>
              <div className="px-3 py-1 text-[10px] font-bold text-white/80 bg-white/10 rounded-md border border-white/10 backdrop-blur-sm uppercase tracking-wider">
                {selectedNode.type.toUpperCase()} ARRAY
              </div>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-5 bg-[#0A0A0A]/80 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Current Output", selectedNode.output, "kWh"],
                ["Current Demand", selectedNode.demand, "kWh"],
              ].map(([lbl, val, unit]) => (
                <div
                  key={lbl}
                  className="bg-white/5 rounded-xl p-3 border border-white/5 shadow-inner flex flex-col"
                >
                  <p className="text-[10px] uppercase font-semibold text-[#A1A1AA] mb-1">
                    {lbl}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-auto">
                    <span className="text-2xl font-bold text-white">{val}</span>
                    <span className="text-white/40 text-xs font-semibold">
                      {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium flex items-center gap-2 text-xs text-[#A1A1AA]">
                  <span className="material-symbols-outlined !text-[16px]">
                    person
                  </span>
                  Owner
                </span>
                <span className="font-mono text-xs bg-white/5 rounded-md px-2.5 py-1 font-medium text-white/90 border border-white/5">
                  0x71C...9A2
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="font-medium flex items-center gap-2 text-xs text-[#A1A1AA]">
                  <span className="material-symbols-outlined !text-[16px]">
                    analytics
                  </span>
                  Efficiency
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-xs">
                    {selectedNode.efficiency}%
                  </span>
                  <div className="w-24 h-2 bg-black rounded-full border border-white/10 overflow-hidden relative">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000"
                      style={{ width: `${selectedNode.efficiency}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => (window.location.href = "/exchange")}
                className="flex-1 skeuo-button text-white rounded-xl py-3 font-semibold text-sm shadow-glow flex items-center justify-center gap-2"
              >
                Trade Energy
              </button>
              <button className="size-12 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors">
                <span className="material-symbols-outlined !text-[20px]">
                  monitoring
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Top stats bar */}
      <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 glass-nav rounded-2xl px-8 py-3 flex items-center gap-8 pointer-events-auto border border-white/10">
        {[
          ["Grid Load", globalMetrics.load],
          ["Active Nodes", globalMetrics.nodes],
          ["CO2 Saved", globalMetrics.co2],
        ].map(([label, val], i) => (
          <div key={label} className="flex items-center gap-8">
            {i > 0 && <div className="w-px h-8 bg-white/10" />}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold">
                {label}
              </span>
              <span className="font-bold text-lg text-white">{val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Right controls */}
      <aside className="absolute right-6 bottom-8 flex flex-col gap-4 z-20 pointer-events-auto">
        <div className="flex flex-col gap-2">
          {/* Zoom Controls */}
          <div className="flex flex-col glass-nav rounded-xl border border-white/10 overflow-hidden shadow-lg">
            <button
              onClick={() => {
                const z = window.faltricMap?.getZoom() || 13;
                window.faltricMap?.setZoom(z + 1);
              }}
              className="size-12 flex items-center justify-center text-white hover:bg-white/10 transition-colors border-b border-white/10"
              title="Zoom In"
            >
              <span className="material-symbols-outlined !text-[24px]">
                add
              </span>
            </button>
            <button
              onClick={() => {
                const z = window.faltricMap?.getZoom() || 13;
                window.faltricMap?.setZoom(z - 1);
              }}
              className="size-12 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined !text-[24px]">
                remove
              </span>
            </button>
          </div>
        </div>

        {/* GPS location / Recenter */}
        <button
          onClick={() => {
            if (window.faltricMap && window.faltricCenter) {
              window.faltricMap.panTo(window.faltricCenter);
            }
          }}
          className="size-12 flex items-center justify-center skeuo-button rounded-xl text-white shadow-glow"
          title="Recenter"
        >
          <span className="material-symbols-outlined !text-[24px] rotate-45">
            navigation
          </span>
        </button>

        {/* Admin only: Add information to map */}
        {isAdmin && (
          <button
            onClick={() => {
              if (drawingModeEnabled) {
                setDrawingModeEnabled(false);
              } else {
                setDrawingModeEnabled(true);
                alert(
                  "Drawing mode enabled! Draw a polygon on the map to register a new plant.",
                );
              }
            }}
            className={`size-14 mt-2 flex items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 ${
              drawingModeEnabled
                ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                : "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:bg-emerald-400"
            }`}
            title="Admin: Draw Map Data"
          >
            <span className="material-symbols-outlined !text-[28px]">
              {drawingModeEnabled ? "close" : "local_fire_department"}
            </span>
          </button>
        )}
      </aside>

      {/* Add Power Plant Modal */}
      {showAddModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="skeuo-card rounded-2xl w-full max-w-md border border-white/10 p-6 flex flex-col gap-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">
                  factory
                </span>
                Register Power Plant
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Deploy a new decentralized energy node to the grid map.
              </p>
            </div>

            <form onSubmit={handleAddPlant} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-[#A1A1AA] tracking-wider">
                  Plant Name
                </label>
                <input
                  type="text"
                  required
                  value={newPlant.name}
                  onChange={(e) =>
                    setNewPlant({ ...newPlant, name: e.target.value })
                  }
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 shadow-inner"
                  placeholder="e.g. Apex Solar Array"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-[#A1A1AA] tracking-wider">
                  Energy Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      type: "Solar",
                      active:
                        "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
                    },
                    {
                      type: "Wind",
                      active:
                        "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]",
                    },
                    {
                      type: "Biogas",
                      active:
                        "bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]",
                    },
                  ].map(({ type, active }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewPlant({ ...newPlant, type })}
                      className={`py-2 rounded-lg text-xs font-semibold uppercase border transition-all ${
                        newPlant.type === type
                          ? active
                          : "bg-black/40 text-white/50 border-white/5 hover:bg-white/5 hover:text-white/80"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-[#A1A1AA] tracking-wider">
                  Max Capacity (Units)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newPlant.capacity}
                  onChange={(e) =>
                    setNewPlant({ ...newPlant, capacity: e.target.value })
                  }
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 shadow-inner font-mono"
                  placeholder="2500"
                />
              </div>

              <button
                type="submit"
                className="skeuo-button mt-4 h-12 rounded-xl text-white font-bold text-sm tracking-wide shadow-glow"
              >
                Deploy to Grid
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
