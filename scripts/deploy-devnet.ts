#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Build and deploy `mcapepe_presale` to devnet.
 *
 * Usage:
 *   yarn deploy:devnet
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

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

  let balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.log("Requesting airdrop...");
    const sig = await connection.requestAirdrop(
      walletKeypair.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig);
    balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`New balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  }

  const projectRoot = path.resolve(__dirname, "..");

  console.log("\nanchor build");
  execSync("anchor build", { cwd: projectRoot, stdio: "inherit" });

  console.log("\nanchor deploy --provider.cluster devnet");
  execSync("anchor deploy --provider.cluster devnet", {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, ANCHOR_WALLET: walletPath },
  });

  console.log("\nDone. Run: yarn initialize:devnet");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
