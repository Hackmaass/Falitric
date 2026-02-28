import WalletAuth from "./components/WalletAuth";
import MapComponent from "./components/Map";
import "./App.css";

function App() {
  return (
    <WalletAuth>
      {/* ── Authenticated app content goes here ── */}
      <MapComponent />
    </WalletAuth>
  );
}

export default App;
