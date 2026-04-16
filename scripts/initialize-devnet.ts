#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Post-deploy: call `initialize` on `mcapepe_presale` (idempotent if already inited).
 *
 * Usage:
 *   yarn initialize:devnet
 *   ANCHOR_PROVIDER_CLUSTER=mainnet yarn initialize:mainnet
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import type { McapepePresale } from "../target/types/mcapepe_presale";

async function main() {
  const cluster = process.env.ANCHOR_PROVIDER_CLUSTER || "devnet";
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ||
    (cluster === "mainnet" || cluster === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : cluster === "devnet"
        ? "https://api.devnet.solana.com"
        : "http://127.0.0.1:8899");

  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".config/solana/deployer.json",
    );

  process.env.ANCHOR_WALLET = walletPath;
  process.env.ANCHOR_PROVIDER_URL = rpcUrl;

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

  const idl = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../target/idl/mcapepe_presale.json"),
      "utf-8",
    ),
  );

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

  const [solVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault")],
    program.programId,
  );

  const sig = await program.methods
    .initialize()
    .accounts({
      admin: wallet.publicKey,
      presaleConfig,
      solVault,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("initialize tx:", sig);
  console.log("presaleConfig:", presaleConfig.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
