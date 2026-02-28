// Connect & Community Chat — Neobrutalist Design with Firebase Realtime Backend
import { useState, useEffect, useRef } from "react";
import { database, ref, push, onValue, get } from "../firebase";

const BATCH_SIZE = 20;

export default function Connect({ user }) {
  const [messages, setMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([
    {
      id: "welcome",
      sender: "system",
      senderName: "Faltric AI Oracle",
      text: "INITIALIZING_NEURAL_LINK... ONLINE. How can I assist with your energy assets today?",
      timestamp: Date.now(),
      role: "admin",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatMode, setChatMode] = useState("user"); // "user" or "ai"
  const [lastBatchTime, setLastBatchTime] = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, aiMessages, chatMode]);

  // Real-time listener for NEW messages
  useEffect(() => {
    const unsub = onValue(ref(database, "chats"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const all = Object.entries(data)
          .map(([id, msg]) => ({
            id,
            ...msg,
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        // Take only the last BATCH_SIZE for the initial view, or all if less
        setMessages(all.slice(-BATCH_SIZE));
        setLoading(false);
      } else {
        setMessages([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (chatMode === "user") {
      const newMessage = {
        sender: user?.wallet_address || "Anonymous",
        senderName: user?.name || "Prosumer",
        text: input.trim(),
        timestamp: Date.now(),
        role: user?.role || "user",
      };
      try {
        await push(ref(database, "chats"), newMessage);
        setInput("");
      } catch (err) {
        console.error(err);
      }
    } else {
      // AI Mode
      const userMsg = {
        id: Date.now().toString(),
        sender: user?.wallet_address || "User",
        text: input.trim(),
        timestamp: Date.now(),
        role: "user",
      };
      setAiMessages((prev) => [...prev, userMsg]);
      const currentInput = input;
      setInput("");

      try {
        const res = await fetch("http://localhost:3000/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentInput,
            history: aiMessages.filter((m) => m.id !== "welcome"),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errorMsg = errData.details
            ? `${errData.error}: ${JSON.stringify(errData.details)}`
            : errData.error || "CONNECTION_TIMEOUT";
          throw new Error(errorMsg);
        }

        const data = await res.json();
        const aiMsg = {
          id: Date.now() + 1,
          sender: "oracle",
          senderName: "Faltric AI Oracle",
          text: data.text,
          timestamp: Date.now(),
          role: "admin",
        };
        setAiMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            sender: "system",
            text: `CONNECTION_FAILURE: ${err.message.toUpperCase()}`,
            timestamp: Date.now(),
            role: "admin",
          },
        ]);
      }
    }
  };

  const loadMore = async () => {
    // Basic batch loading logic
    // In a real scenarios we'd use endAt/limitToLast more precisely
    // but our mock server/proxy handles a simple limitToLast as a slice.
    // For now, let's keep it simple as real-time handles the updates.
  };

  const currentMessages = chatMode === "user" ? messages : aiMessages;

  return (
    <main className="bg-[#0a0a0a] text-white h-screen flex flex-col overflow-hidden font-display pt-24">
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col relative bg-[#111] border-x-2 border-white/5 overflow-hidden">
          {/* Channel header */}
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a] shrink-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-lg ${chatMode === "user" ? "text-emerald-500" : "text-purple-500"}`}
                >
                  {chatMode === "user" ? "tag" : "psychology"}
                </span>
                <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                  {chatMode === "user"
                    ? "global-grid-chat"
                    : "ai-oracle-terminal"}
                </h2>
              </div>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                {chatMode === "user"
                  ? "Main hub for global energy grid discussions."
                  : "Direct interface with Faltrics neural grid intelligence."}
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex bg-[#1a1a1a] border border-white/10 p-1">
              <button
                onClick={() => setChatMode("user")}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${chatMode === "user" ? "bg-white text-black font-black" : "text-gray-500 hover:text-white"}`}
              >
                LIVE_GRID
              </button>
              <button
                onClick={() => setChatMode("ai")}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${chatMode === "ai" ? "bg-purple-600 text-white font-black" : "text-gray-500 hover:text-white"}`}
              >
                AI_ORACLE
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className={`flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide ${chatMode === "ai" ? "bg-[#0a0a0d]" : "bg-[#0f0f0f]"}`}
          >
            {loading && chatMode === "user" ? (
              <div className="flex items-center justify-center h-full">
                <div className="font-mono text-xs animate-pulse text-emerald-500">
                  CONNECTING TO GRID_NODE...
                </div>
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 italic font-mono text-sm">
                <span className="material-symbols-outlined text-4xl mb-2">
                  forum
                </span>
                <span>No transmissions recorded yet.</span>
              </div>
            ) : (
              currentMessages.map((msg, i) => {
                const isMe =
                  msg.sender === (user?.wallet_address || "User") &&
                  msg.role !== "admin";
                const showDate =
                  i === 0 ||
                  new Date(currentMessages[i - 1].timestamp).toDateString() !==
                    new Date(msg.timestamp).toDateString();
                const isOracle =
                  msg.sender === "oracle" || msg.sender === "system";

                return (
                  <div key={msg.id} className="flex flex-col gap-4">
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <div className="h-px bg-white/10 flex-1"></div>
                        <span className="px-4 text-[10px] font-mono text-gray-600 uppercase tracking-[0.2em]">
                          {new Date(msg.timestamp).toLocaleDateString()}
                        </span>
                        <div className="h-px bg-white/10 flex-1"></div>
                      </div>
                    )}
                    <div
                      className={`flex gap-4 group ${isMe ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`w-10 h-10 border border-white/10 shrink-0 flex items-center justify-center transition-all ${msg.role === "admin" ? (isOracle ? "bg-purple-900/50 border-purple-500" : "bg-emerald-900/50 border-emerald-500") : "bg-white/5"}`}
                      >
                        <span
                          className={`material-symbols-outlined text-xl ${msg.role === "admin" ? "text-white" : "text-white/50"}`}
                        >
                          {isOracle
                            ? "auto_awesome"
                            : msg.role === "admin"
                              ? "admin_panel_settings"
                              : "person"}
                        </span>
                      </div>
                      <div
                        className={`flex flex-col max-w-xl ${isMe ? "items-end" : ""}`}
                      >
                        <div
                          className={`flex items-baseline gap-3 mb-1 ${isMe ? "flex-row-reverse" : ""}`}
                        >
                          <span
                            className={`font-mono text-xs font-bold ${isMe ? "text-emerald-400" : isOracle ? "text-purple-400" : "text-gray-400"}`}
                          >
                            {msg.senderName ||
                              (msg.sender && msg.sender.length > 10
                                ? `${msg.sender.slice(0, 6)}...${msg.sender.slice(-4)}`
                                : msg.sender)}
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          className={`border p-4 shadow-brutal transition-all ${isMe ? "bg-white border-white text-black" : isOracle ? "bg-purple-950/20 border-purple-500/30 text-purple-100" : "bg-[#1a1a1a] border-white/10 text-gray-200"}`}
                        >
                          <p
                            className={`text-sm font-medium leading-relaxed ${isOracle ? "font-mono" : ""}`}
                          >
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Panel */}
          <div className="p-6 bg-[#0a0a0a] border-t border-white/5 shrink-0 z-10">
            <form onSubmit={send} className="flex flex-col gap-3">
              <div
                className={`flex items-end gap-0 bg-[#161616] border-2 p-0 relative group transition-all ${chatMode === "ai" ? "border-purple-500/20 focus-within:border-purple-500" : "border-white/20 focus-within:border-white"}`}
              >
                <button
                  type="button"
                  className="p-4 text-gray-500 hover:text-white transition-colors border-r border-white/5 h-full"
                >
                  <span className="material-symbols-outlined">
                    {chatMode === "user" ? "add_circle" : "bolt"}
                  </span>
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  className="w-full bg-transparent border-none text-white focus:ring-0 resize-none py-4 px-4 min-h-[56px] font-display text-sm placeholder-white/20"
                  placeholder={
                    chatMode === "user"
                      ? "Broadcast message to the grid..."
                      : "Ask the AI Oracle about the energy market..."
                  }
                  rows="1"
                ></textarea>
                <div className="flex items-center gap-1 pr-2 pb-2">
                  <button
                    type="submit"
                    className={`text-black font-black px-6 py-2 border-2 border-transparent transition-all uppercase text-[10px] tracking-widest ${chatMode === "ai" ? "bg-purple-600 text-white hover:bg-black hover:border-purple-600" : "bg-white hover:bg-black hover:text-white hover:border-white"}`}
                  >
                    {chatMode === "user" ? "SEND" : "QUERY"}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                  <b>ENTER</b> to transmit • <b>SHIFT+ENTER</b> for newline
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 opacity-50">
                    <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-mono text-gray-400">
                      ENCRYPTED_NODE
                    </span>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      <style>{`
        .shadow-brutal {
          box-shadow: 4px 4px 0px 0px rgba(255, 255, 255, 0.05);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </main>
  );
}
