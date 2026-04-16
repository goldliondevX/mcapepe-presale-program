#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Build and deploy `mcapepe_presale` to mainnet-beta.
 *
 * Usage:
 *   yarn deploy:mainnet
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

async function main() {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.MAINNET_RPC_URL ||
    "https://api.mainnet-beta.solana.com";

  const connection = new Connection(rpcUrl, "confirmed");

  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".config/solana/deployer.json",
    );

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}`);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))),
  );

  console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < LAMPORTS_PER_SOL / 10) {
    throw new Error("Insufficient SOL for deployment");
  }

  const projectRoot = path.resolve(__dirname, "..");

  console.log("\nanchor build");
  execSync("anchor build", { cwd: projectRoot, stdio: "inherit" });

  console.log("\nanchor deploy --provider.cluster mainnet");
  execSync("anchor deploy --provider.cluster mainnet", {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, ANCHOR_WALLET: walletPath },
  });

  console.log("\nDone. Run: yarn initialize:mainnet");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
