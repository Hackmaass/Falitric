import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar({ user, onLogout }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState(true);

  const isAdmin = user?.role === "admin";
  const isWallet = user?.wallet_address && user.wallet_address.startsWith("0x");
  const short = isWallet
    ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
    : null;

  const NAV_LINKS = [
    { to: "/", label: "Home", icon: "home" },
    { to: "/about", label: "About", icon: "info" },
    { to: "/gridmap", label: "Grid Map", icon: "map" },
    { to: "/ai-dashboard", label: "AI Dashboard", icon: "auto_awesome" },
    { to: "/exchange", label: "Exchange", icon: "swap_horiz" },
    { to: "/connect", label: "Connect", icon: "hub" },
    ...(isAdmin
      ? [{ to: "/admin", label: "Admin", icon: "admin_panel_settings" }]
      : []),
  ];

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className=" w-full justify-between glass-nav rounded-2xl px-2 py-2 flex items-center gap-1 sm:gap-2 pointer-events-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-2 mr-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 shadow-skeuo-inner text-white border border-white/10">
            <span className="material-symbols-outlined !text-lg text-white/90">
              bolt
            </span>
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white flex items-center gap-2">
            Faltric
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-500/30">
                Admin
              </span>
            )}
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center bg-white/5 rounded-xl px-1 py-1 border border-white/5 shadow-inner">
          {NAV_LINKS.map(({ to, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? "text-white bg-white/10 shadow-sm"
                    : "text-[#A1A1AA] hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* <div className="w-px h-6 bg-white/10 mx-2 hidden md:block"></div> */}

        {/* Wallet + balance + logout */}
        <div className="flex items-center gap-2">
          {short && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Balance
              </span>
              <span className="text-sm font-bold text-white font-mono">
                {user.token_balance
                  ? parseFloat(user.token_balance).toLocaleString()
                  : "0"}{" "}
                <span className="text-[10px] text-emerald-400/60 font-sans uppercase">
                  Fal
                </span>
              </span>
            </div>
          )}

          {short ? (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono text-white/90">{short}</span>
            </div>
          ) : (
            <Link
              to="/connect"
              className="hidden border border-white/10 md:flex skeuo-button rounded-xl px-5 py-2.5 items-center gap-2 group"
            >
              <span className="material-symbols-outlined !text-[18px] text-white/70 group-hover:text-white transition-colors">
                account_balance_wallet
              </span>
              <span className="text-sm font-medium text-white/90 group-hover:text-white">
                Connect
              </span>
            </Link>
          )}

          {user && onLogout && (
            <button
              onClick={onLogout}
              className="hidden md:flex p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              title="Disconnect"
            >
              <span className="material-symbols-outlined !text-[20px]">
                logout
              </span>
            </button>
          )}

          <button
            onClick={() => {
              if (window.toggleFaltricAudio) {
                const muted = window.toggleFaltricAudio();
                setAudioMuted(muted);
              }
            }}
            className="sndbx hidden sm:flex p-2.5 rounded-xl text-[#A1A1AA] hover:text-white hover:bg-white/5 transition-colors"
            title={audioMuted ? "Unmute Audio" : "Mute Audio"}
          >
            <span className="material-symbols-outlined !text-[20px]">
              {audioMuted ? "volume_off" : "volume_up"}
            </span>
          </button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2.5 text-[#A1A1AA] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="material-symbols-outlined">
              {menuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="absolute top-[calc(100%+12px)] left-0 right-0 glass-nav rounded-2xl p-2 flex flex-col md:hidden border border-white/10 shadow-2xl">
            {NAV_LINKS.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  pathname === to
                    ? "bg-white/10 text-white"
                    : "text-[#A1A1AA] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined !text-[18px]">
                  {icon}
                </span>
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
            {short && (
              <div className="flex items-center justify-between px-4 py-3 mt-2 border-t border-white/10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-mono text-white/90">
                      {short}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-1">
                    {user.token_balance
                      ? parseFloat(user.token_balance).toLocaleString()
                      : "0"}{" "}
                    FAL
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-[#A1A1AA] hover:text-white"
                  >
                    <span className="material-symbols-outlined !text-[18px]">
                      logout
                    </span>
                  </button>
                )}
              </div>
            )}
            {!short && (
              <Link
                to="/connect"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 mt-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-medium transition-colors"
              >
                <span className="material-symbols-outlined !text-[18px]">
                  account_balance_wallet
                </span>
                Connect Wallet
              </Link>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
