#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Post-deploy: call `initialize` on `mcapepe_presale` (idempotent if already inited).
 *
 * Usage:
 *   yarn initialize:devnet
 *   yarn initialize:mainnet
 *
 * Note: repo `.env` often sets `ANCHOR_PROVIDER_CLUSTER=devnet`. This script
 * preserves `ANCHOR_PROVIDER_CLUSTER` / `ANCHOR_PROVIDER_URL` from the shell
 * (e.g. `yarn initialize:mainnet`) so they are not overwritten by `.env`.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import type { McapepePresale } from "../target/types/mcapepe_presale";

import {
  defaultWalletPath,
  expandPath,
  loadProjectEnv,
} from "./env-utils";

/** Set after resolving cluster (used in `main().catch` help text). */
let resolvedClusterForHelp = "devnet";

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const presetCluster = process.env.ANCHOR_PROVIDER_CLUSTER;
  const presetRpc = process.env.ANCHOR_PROVIDER_URL;

  loadProjectEnv(projectRoot, { overwrite: true });

  const cluster =
    presetCluster || process.env.ANCHOR_PROVIDER_CLUSTER || "devnet";
  resolvedClusterForHelp = cluster;
  const isMainnet =
    cluster === "mainnet" || cluster === "mainnet-beta";

  const rpcUrl =
    presetRpc ||
    (isMainnet
      ? process.env.MAINNET_RPC_URL ||
        "https://api.mainnet.solana.com"
      : cluster === "devnet"
        ? process.env.ANCHOR_PROVIDER_URL ||
          "https://api.devnet.solana.com"
        : process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899");

  const walletPath = expandPath(
    process.env.ANCHOR_WALLET || defaultWalletPath(),
  );

  process.env.ANCHOR_WALLET = walletPath;
  process.env.ANCHOR_PROVIDER_URL = rpcUrl;

  console.log(`Using cluster=${cluster} RPC=${rpcUrl}`);

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))),
    ),
  );

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idlPath = path.join(process.cwd(), "target/idl/mcapepe_presale.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(
      `IDL not found at ${idlPath}. Run \`anchor build\` first.`,
    );
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const program = new Program(
    idl,
    provider,
  ) as Program<McapepePresale>;

  const [presaleConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId,
  );

  const info = await connection.getAccountInfo(presaleConfig);
  if (info) {
    console.log("PresaleConfig already exists; skipping initialize.");
    return;
  }

  // Anchor 0.32: `.accounts()` only lists accounts the client cannot resolve
  // (PDAs + fixed-address accounts are resolved from the IDL).
  const sig = await program.methods.initialize().accounts({
    admin: wallet.publicKey,
  }).rpc();

  console.log("initialize tx:", sig);
  console.log("presaleConfig:", presaleConfig.toBase58());
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("does not exist") || msg.includes("Program account")) {
    const isMainnet =
      resolvedClusterForHelp === "mainnet" ||
      resolvedClusterForHelp === "mainnet-beta";
    console.error(
      isMainnet
        ? "The program is not deployed on mainnet yet. Run `yarn deploy:mainnet`, then retry."
        : "The program is not deployed on this cluster yet. Run `yarn deploy:devnet`, then retry.",
    );
  }
  console.error(e);
  process.exit(1);
});
