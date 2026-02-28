// scripts/deploy.js — Run with: bunx hardhat run scripts/deploy.js --network sepolia
import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const ethers = connection.ethers;

  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying FaltricToken with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  const FaltricToken = await ethers.getContractFactory("FaltricToken");
  const token = await FaltricToken.deploy(deployer.address);

  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log("✅ FaltricToken (FAL) deployed to:", address);
  console.log("📋 Token Name:", await token.name());
  console.log("🔤 Token Symbol:", await token.symbol());
  console.log("📐 Decimals:", await token.decimals());
  console.log("🔑 Owner:", await token.owner());

  console.log("\n─── Add this to your server/.env ───");
  console.log(`FALTRIC_TOKEN_ADDRESS=${address}`);
  console.log("────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
