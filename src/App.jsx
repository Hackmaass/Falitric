import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WalletAuth from "./components/WalletAuth";
// import "./App.css"
import Dashboard from "./pages/Dashboard";
import GridMap from "./pages/GridMap";
import Exchange from "./pages/Exchange";
import Connect from "./pages/Connect";
import Admin from "./pages/Admin";
import AiDashboard from "./pages/AiDashboard";
import AboutUs from "./pages/AboutUs";
import bgMusic from "./assets/backg.mp3";
import { useEffect, useRef } from "react";

function App() {
  const audioRef = useRef(null);

  useEffect(() => {
    const playAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().catch((err) => {
          console.log(
            "Audio autoplay was prevented. User interaction needed.",
            err,
          );
        });
      }
    };

    // Try playing immediately
    playAudio();

    // Listen for first interaction to play if blocked initially
    window.addEventListener("click", playAudio, { once: true });

    return () => window.removeEventListener("click", playAudio);
  }, []);

  return (
    <BrowserRouter>
      <audio ref={audioRef} src={bgMusic} loop />
      <WalletAuth>
        {(user) => (
          <div className="App">
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
          </div>
        )}
      </WalletAuth>
    </BrowserRouter>
  );
}

export default App;
