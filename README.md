# 🌿 Faltric

**Decentralized Renewable Energy Marketplace & AI-Driven Grid Intelligence**

> _"Empowering communities to own, trade, and sustain clean energy — one kilowatt at a time."_

---

### Problem Understanding & Clarity

![alt text](/src/assets/earth.jpeg)

India's energy landscape suffers from a **critical last-mile gap**: millions of households with rooftop solar panels, small biogas units, or micro-wind setups generate surplus renewable energy but have **no mechanism to monetize or redistribute it**. The current grid model is centralized, opaque, and slow — leaving prosumers (producer + consumer) stranded, while urban demand spikes go unmet and clean energy goes to waste.

**Faltric** directly addresses this: a platform where any energy producer — a farmer with a solar pump, a housing society with rooftop panels, or a biogas plant — can **tokenize, list, and trade** their surplus energy in real time with nearby consumers or the grid.

---

### Innovation & Originality

Faltric introduces a **three-layer innovation stack** unseen in current Indian energy markets:

1.  **Energy NFT Tokenization** — Each kilowatt-hour of verified renewable generation is minted as a token (1 Token = 1 kWh) on the Ethereum Sepolia blockchain. This creates an auditable, tamper-proof ledger of green energy production.

2.  **AI-Powered Yield Forecasting** — A fine-tuned GPT-Neo model, enriched with OpenWeatherMap data and India's historical electricity consumption dataset, predicts generation capacity up to 72 hours ahead — enabling smarter trades and buffer planning.

3.  **Google Maps GIS Grid Intelligence** — Unlike static dashboards, Faltric's **GridMap** (powered by **Google Maps API**) renders live renewable energy nodes geographically. Electricity Department admins can draw certified installation polygons directly on the map, bridging regulatory compliance with real-world geography.

---

### Relevance to Green Energy & Sustainability

Faltric is purpose-built for the **circular green economy**:

| Sustainability Pillar    | Faltric's Role                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| 🌞 Solar / Wind / Biogas | Supports all three renewable source types                         |
| ♻️ Circular Economy      | Surplus energy is never wasted — it's redistributed peer-to-peer  |
| 📉 Carbon Offset         | Blockchain ledger provides verifiable carbon credit trails        |
| 🌍 Community Ownership   | Decentralized model removes corporate middlemen from clean energy |
| 🏛️ Regulatory Alignment  | Grid Admin Portal aligns with India's RE integration policies     |

---

![alt text](/src/assets/earth.png)

### Feasibility & Practicality

Faltric is **production-ready in architecture** and built on proven, open-source technologies:

- **Frontend:** Vite React — fast HMR development, deployable on Vercel/Netlify instantly. Runs via **Bun** for ultra-fast package installs and script execution.
- **Backend:** Node.js / Express.js with Socket.io for real-time WebSocket communication.
- **Mapping:** **Google Maps JavaScript API** for dynamic GIS node rendering, polygon drawing (Grid Admin), and live trade activity overlays.
- **Blockchain:** Ethereum Sepolia Testnet with Hardhat + Solidity smart contracts — production migration to mainnet requires only an RPC endpoint swap.
- **AI Engine:** Python FastAPI microservice with GPT-Neo fine-tuned on publicly available datasets — independently scalable.
- **Smart Meter Input:** IoT-compatible REST endpoints accept real-time generation data from industry-standard smart meters.

The platform requires **no new hardware** from end users — existing smart meters and MetaMask wallets are sufficient to participate.

---

### Impact Potential

| Dimension           | Projected Impact                                                                        |
| ------------------- | --------------------------------------------------------------------------------------- |
| 🌱 Environmental    | Reduces renewable energy waste; enables carbon credit verification per transaction      |
| 👥 Social           | Empowers rural farmers, housing societies, and small businesses as energy entrepreneurs |
| 💰 Economic         | Creates a new micro-revenue stream for prosumers; reduces consumer electricity bills    |
| 📡 Scale            | Horizontal architecture supports national rollout across India's 28 states              |
| 🏆 Policy Alignment | Directly supports India's 500 GW renewable energy target by 2030                        |

---

## ⚡ Core Features

- **Faltric Exchange (P2P Trading):** Tokenize smart meter energy generation (1 Token = 1 kWh) and trade directly with peers using Ethereum Sepolia smart contracts.
- **Faltric Predict (AI Insights):** Utilizes a fine-tuned GPT-Neo model and DeepSeek API, combined with OpenWeather API and India's electricity consumption dataset, to forecast generation and provide actionable energy strategies.
- **Faltric GridMap:** A public, interactive map powered by **Google Maps API** displaying renewable energy nodes (🟡 Solar · 🟤 Wind · 🟢 Biogas) and real-time P2P trade activities.
- **Faltric Connect:** A WebSocket-powered global community chat for sustainability discussions and direct market negotiations.
- **Grid Admin Portal:** Exclusive access for Electricity Department officials to draw geographic polygons on Google Maps for certified installations and monitor grid health.

---

## 🛠 Tech Stack

### Frontend _(Neobrutalism & Glassmorphism Design)_

| Technology                     | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| **Vite + React**               | Core framework with fast HMR                          |
| **Bun**                        | Package manager & script runner                       |
| CSS Modules                    | Strict, scoped component styling                      |
| **Google Maps JavaScript API** | Interactive GIS grid map, node markers, polygon tools |
| Higgsfield API                 | Dynamic hero video integration                        |

### Backend & AI

| Technology           | Purpose                                   |
| -------------------- | ----------------------------------------- |
| Node.js / Express.js | REST API server                           |
| Socket.io            | Real-time WebSocket communication         |
| Python / FastAPI     | AI microservice layer                     |
| GPT-Neo (Fine-tuned) | Energy yield forecasting model            |
| DeepSeek API         | Supplemental AI reasoning                 |
| OpenWeatherMap API   | Live weather data for forecast enrichment |

### Web3 & Blockchain

| Technology                  | Purpose                                 |
| --------------------------- | --------------------------------------- |
| Ethereum Sepolia Testnet    | P2P energy trading network              |
| Solidity + Hardhat          | Smart contract development              |
| Ethers.js + MetaMask (SIWE) | Wallet connection & transaction signing |

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/faltric.git
cd faltric
```

> 💡 Ensure [Bun](https://bun.sh) is installed: `curl -fsSL https://bun.sh/install | bash`

### 2. Install Dependencies

```bash
# Frontend (Vite React)
cd client && bun install

# Backend
cd ../server && bun install

# AI Microservice
cd ../ai-engine && pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create `.env` files in their respective directories:

#### `client/.env.local`

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_HIGGSFIELD_API_KEY=your_higgsfield_api_key_here
```

#### `server/.env`

```env
OPENWEATHER_API_KEY=your_openweather_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
SEPOLIA_RPC_URL=your_alchemy_or_infura_rpc_url_here
PRIVATE_KEY=your_wallet_private_key_for_contract_deployment
```

> ⚠️ **Never commit `.env` files to version control. Add them to `.gitignore`.**

#### Getting your Google Maps API Key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Library**
4. Enable: **Maps JavaScript API**, **Geocoding API**, **Places API**
5. Go to **APIs & Services → Credentials → Create Credentials → API Key**
6. Restrict the key to your domain for production

### 4. Run the Application

```bash
# Terminal 1 — Vite React Frontend (via Bun)
cd client && bun run dev

# Terminal 2 — Node.js Backend (via Bun)
cd server && bun run start

# Terminal 3 — Python AI Engine
cd ai-engine && uvicorn main:app --reload
```

---

## 🗺️ Google Maps Integration Details

Faltric's **GridMap** uses the Google Maps JavaScript API to:

- **Render Energy Nodes:** Custom markers for Solar (🟡), Wind (🟤), and Biogas (🟢) installations across the map.
- **Live Trade Overlays:** Animated polylines between buyer and seller nodes during active P2P transactions.
- **Admin Polygon Tool:** Grid Department admins use the `google.maps.drawing.DrawingManager` to define certified renewable installation zones.
- **Info Windows:** Click any node to view real-time generation stats, token price, and trade history.

---

## 🤝 Core Development Team

Developed and maintained by **Team Falcons** for the **Execute Hackathon 2026**.

| Role                           | Member                 |
| ------------------------------ | ---------------------- |
| 🏗️ Lead Architect              | Sarthak Tulsidas Patil |
| 🔌 Data & Backend API Handling | Utkarsh Vidwat         |
| 🤖 AI Content Creation         | Sneha Patidar          |
| 🔍 Researcher                  | Sneha Sharma           |

---

_Built with 💚 for a greener, decentralized energy future._
