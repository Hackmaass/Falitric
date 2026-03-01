import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WalletAuth from "./components/WalletAuth";
import bgMusic from "./assets/backg.mp3";

// Lazy load pages for bundle optimization
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GridMap = lazy(() => import("./pages/GridMap"));
const Exchange = lazy(() => import("./pages/Exchange"));
const Connect = lazy(() => import("./pages/Connect"));
const Admin = lazy(() => import("./pages/Admin"));
const AiDashboard = lazy(() => import("./pages/AiDashboard"));
const AboutUs = lazy(() => import("./pages/AboutUs"));

// Initial Loading Fallback
const PageLoader = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-[#050505]">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
  </div>
);

function App() {
  const audioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const playAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().catch((err) => {
          // Silent catch for initial blocked autoplay
        });
      }
    };

    // Try playing immediately
    playAudio();

    // Listen for first interaction to play if blocked initially
    window.addEventListener("click", playAudio, { once: true });

    // Expose toggle to window
    window.toggleFaltricAudio = () => {
      setIsMuted((m) => !m);
      return !isMuted; // Return new state
    };

    return () => {
      window.removeEventListener("click", playAudio);
      delete window.toggleFaltricAudio;
    };
  }, [isMuted]);

  return (
    <BrowserRouter>
      <audio ref={audioRef} src={bgMusic} loop />
      <WalletAuth>
        {(user) => (
          <div className="App">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/gridmap" element={<GridMap user={user} />} />
                <Route path="/about" element={<AboutUs />} />
                <Route
                  path="/ai-dashboard"
                  element={<AiDashboard user={user} />}
                />
                <Route path="/exchange" element={<Exchange user={user} />} />
                <Route path="/connect" element={<Connect user={user} />} />
                <Route
                  path="/admin"
                  element={
                    user?.role === "admin" ? (
                      <Admin user={user} />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  }
                />
              </Routes>
            </Suspense>
          </div>
        )}
      </WalletAuth>
    </BrowserRouter>
  );
}

export default App;
