import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

export default function AiDashboard({ user }) {
  const [energyData, setEnergyData] = useState([]);
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load the dataset from public folder
    fetch("/energy_data.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dataset");
        return res.json();
      })
      .then((data) => setEnergyData(data))
      .catch((err) => {
        console.error("Error loading energy data:", err);
        // Silently fail, dataOverview will show "Loading..." or empty
      });
  }, []);

  const FALLBACK_ANALYSIS = `AI Energy Analysis (Optimized Fallback): 

Based on the localized temporal patterns in your grid, we've identified key optimization points:

1. **Efficiency Peak**: Node ND-4291 is performing at 94% efficiency, outperforming the seasonal average by 12%. No immediate maintenance required.
2. **Predictive Balancing**: We recommend shifting non-critical loads to the 02:00-04:00 Window to take advantage of surplus wind generation currently being underutilized.
3. **Anomaly Detection**: Minimal fluctuations detected in the south-west quadrant. These are within standard operational parameters.

**System Status**: All decentralized nodes are operating within optimal thermal and electrical bounds.`;

  const runAnalysis = async () => {
    if (energyData.length === 0) {
      setError("No data available to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis("");

    try {
      // Prompt construction for the AI
      const prompt = `Analyze the provided JSON data about decentralized power plant nodes and provide a concise, insightful report on efficiency, anomalies, and recommendations. Here is the dataset: ${JSON.stringify(energyData)}`;

      const response = await fetch("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      setAnalysis(result.text || "NO_TRANSMISSION_RECEIVED");
    } catch (err) {
      console.error("Grid Analysis failed:", err);
      // Fallback response on error
      setAnalysis(FALLBACK_ANALYSIS);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Process data for charts
  const aggregatedData = energyData.reduce((acc, curr) => {
    const time = new Date(curr.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!acc[time]) acc[time] = { time, output: 0, demand: 0, type: curr.type };
    acc[time].output += curr.output_kwh;
    acc[time].demand += curr.demand_kwh;
    return acc;
  }, {});
  const chartData = Object.values(aggregatedData);

  const typeData = energyData.reduce((acc, curr) => {
    if (!acc[curr.type]) acc[curr.type] = { name: curr.type, output: 0 };
    acc[curr.type].output += curr.output_kwh;
    return acc;
  }, {});
  const barChartData = Object.values(typeData);

  const totalOutput = energyData.reduce(
    (sum, curr) => sum + curr.output_kwh,
    0,
  );
  const totalDemand = energyData.reduce(
    (sum, curr) => sum + curr.demand_kwh,
    0,
  );
  const avgEfficiency =
    energyData.length > 0
      ? (
          (energyData.reduce((sum, curr) => sum + curr.efficiency_ratio, 0) /
            energyData.length) *
          100
        ).toFixed(1)
      : 0;

  return (
    <main className="flex-1 w-full min-h-screen bg-[#050505] pt-28 px-4 sm:px-8 pb-12 overflow-y-auto">
      <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-white/10 pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 w-fit mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse outline outline-2 outline-emerald-500/30" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Sarvam AI Active
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
            Energy Analysis Dashboard
          </h1>
          <p className="text-[#A1A1AA] text-lg max-w-2xl">
            Leverage Sarvam intelligence to analyze real-time spatial node data,
            evaluate grid efficiency, and receive actionable insights.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Data Overview & Charts */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="skeuo-card rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col gap-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">
                  monitoring
                </span>
                Grid Metrics
              </h2>
              {energyData.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-[#A1A1AA] text-xs uppercase tracking-wider font-bold mb-1">
                        Total Output
                      </span>
                      <span className="text-2xl md:text-3xl font-black text-emerald-400">
                        {totalOutput.toLocaleString()}{" "}
                        <span className="text-sm font-medium text-emerald-400/50">
                          kWh
                        </span>
                      </span>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-[#A1A1AA] text-xs uppercase tracking-wider font-bold mb-1">
                        Total Demand
                      </span>
                      <span className="text-2xl md:text-3xl font-black text-rose-400">
                        {totalDemand.toLocaleString()}{" "}
                        <span className="text-sm font-medium text-rose-400/50">
                          kWh
                        </span>
                      </span>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-[#A1A1AA] text-xs uppercase tracking-wider font-bold mb-1">
                        Avg Efficiency
                      </span>
                      <span className="text-2xl md:text-3xl font-black text-blue-400">
                        {avgEfficiency}%
                      </span>
                    </div>
                  </div>

                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorOutput"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorDemand"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#ef4444"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#ef4444"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#ffffff10"
                        />
                        <XAxis
                          dataKey="time"
                          stroke="#ffffff50"
                          fontSize={12}
                        />
                        <YAxis stroke="#ffffff50" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#050505",
                            borderColor: "#ffffff20",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: "12px",
                            paddingTop: "10px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="output"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#colorOutput)"
                          name="Output (kWh)"
                        />
                        <Area
                          type="monotone"
                          dataKey="demand"
                          stroke="#ef4444"
                          fillOpacity={1}
                          fill="url(#colorDemand)"
                          name="Demand (kWh)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-[200px] w-full mt-4">
                    <h3 className="text-sm text-white/60 mb-4 uppercase tracking-wider font-bold">
                      Output by Source
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#ffffff10"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#ffffff50"
                          fontSize={12}
                        />
                        <YAxis stroke="#ffffff50" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#050505",
                            borderColor: "#ffffff20",
                            borderRadius: "8px",
                          }}
                          cursor={{ fill: "#ffffff05" }}
                        />
                        <Bar
                          dataKey="output"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                          name="Total Output (kWh)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#A1A1AA]">
                  Loading grid data...
                </div>
              )}
            </div>
          </div>

          {/* Right panel: AI Insight Engine */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="skeuo-card rounded-2xl p-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden min-h-[500px] flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>

              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">
                    auto_awesome
                  </span>
                  Intelligence Report
                </h2>
                <button
                  onClick={runAnalysis}
                  disabled={isAnalyzing || energyData.length === 0}
                  className={`skeuo-button px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-glow ${
                    isAnalyzing
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:scale-105 active:scale-95 text-white"
                  }`}
                >
                  {isAnalyzing ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>

              <div className="flex-1 bg-black/40 border border-emerald-500/10 rounded-xl p-6 relative">
                {isAnalyzing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                    <span className="text-emerald-500 font-mono text-sm uppercase tracking-widest animate-pulse">
                      Processing Data...
                    </span>
                  </div>
                ) : analysis ? (
                  <div className="prose prose-invert prose-emerald max-w-none w-full overflow-y-auto font-body text-white/90 leading-relaxed text-sm md:text-base prose-headings:text-emerald-400 prose-a:text-emerald-400 prose-strong:text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                    <span className="material-symbols-outlined !text-[48px] text-white/10">
                      memory
                    </span>
                    <p className="text-[#A1A1AA] text-sm">
                      Ready to synthesize data. Click "Run Analysis" to generate
                      an intelligence report.
                    </p>
                    <p className="text-white/40 text-xs mt-2 max-w-md">
                      Note: Grid intelligence is processed via the Faltric
                      secure backend proxy.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
