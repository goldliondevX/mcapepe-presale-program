import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import BN from "bn.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import type { McapepePresale } from "../target/types/mcapepe_presale";

describe("mcapepe_presale", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "target/idl/mcapepe_presale.json"),
      "utf-8",
    ),
  );
  const program = new anchor.Program(
    idl,
    provider,
  ) as Program<McapepePresale>;

  const admin = provider.wallet as anchor.Wallet;
  const user = Keypair.generate();
  const treasury = Keypair.generate();

  const pda = {
    presaleConfig: () =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        program.programId,
      )[0],
    vaultAuth: () =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("vault_auth")],
        program.programId,
      )[0],
    solVault: () =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("sol_vault")],
        program.programId,
      )[0],
    userDepositSpl: (owner: PublicKey, mint: PublicKey) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), owner.toBuffer(), mint.toBuffer()],
        program.programId,
      )[0],
    userDepositNative: (owner: PublicKey) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), owner.toBuffer(), Buffer.from("native")],
        program.programId,
      )[0],
  };

  let mint: PublicKey;

  before(async () => {
    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      5 * LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig);

    mint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6,
    );

    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey,
    );
    await mintTo(
      provider.connection,
      admin.payer,
      mint,
      userAta.address,
      admin.publicKey,
      1_000_000_000n,
    );
  });

  it("initializes presale", async () => {
    await program.methods
      .initialize()
      .accounts({
        admin: admin.publicKey,
        presaleConfig: pda.presaleConfig(),
        solVault: pda.solVault(),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.presaleConfig.fetch(pda.presaleConfig());
    assert.equal(cfg.admin.toBase58(), admin.publicKey.toBase58());
    assert.equal(cfg.treasury.toBase58(), admin.publicKey.toBase58());
    assert.equal(cfg.allowedMintsLen, 0);
  });

  it("adds allowed mint and vault ATA", async () => {
    await program.methods
      .addAllowedMint()
      .accounts({
        admin: admin.publicKey,
        presaleConfig: pda.presaleConfig(),
        mint,
        vaultAuth: pda.vaultAuth(),
        vaultTokenAccount: getAssociatedTokenAddressSync(
          mint,
          pda.vaultAuth(),
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.presaleConfig.fetch(pda.presaleConfig());
    assert.equal(cfg.allowedMintsLen, 1);
    assert.equal(cfg.allowedMints[0].toBase58(), mint.toBase58());
  });

  it("buy_spl accumulates user deposit", async () => {
    const userAta = getAssociatedTokenAddressSync(
      mint,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const vaultAta = getAssociatedTokenAddressSync(
      mint,
      pda.vaultAuth(),
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    await program.methods
      .buySpl(new BN(100))
      .accounts({
        presaleConfig: pda.presaleConfig(),
        user: user.publicKey,
        mint,
        userTokenAccount: userAta,
        vaultAuth: pda.vaultAuth(),
        vaultTokenAccount: vaultAta,
        userDeposit: pda.userDepositSpl(user.publicKey, mint),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    await program.methods
      .buySpl(new BN(50))
      .accounts({
        presaleConfig: pda.presaleConfig(),
        user: user.publicKey,
        mint,
        userTokenAccount: userAta,
        vaultAuth: pda.vaultAuth(),
        vaultTokenAccount: vaultAta,
        userDeposit: pda.userDepositSpl(user.publicKey, mint),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const dep = await program.account.userDeposit.fetch(
      pda.userDepositSpl(user.publicKey, mint),
    );
    assert.equal(dep.amount.toString(), "150");
  });

  it("buy_native_sol accumulates native deposit", async () => {
    await program.methods
      .buyNativeSol(new BN(LAMPORTS_PER_SOL / 10))
      .accounts({
        presaleConfig: pda.presaleConfig(),
        user: user.publicKey,
        solVault: pda.solVault(),
        userDeposit: pda.userDepositNative(user.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    await program.methods
      .buyNativeSol(new BN(LAMPORTS_PER_SOL / 20))
      .accounts({
        presaleConfig: pda.presaleConfig(),
        user: user.publicKey,
        solVault: pda.solVault(),
        userDeposit: pda.userDepositNative(user.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const dep = await program.account.userDeposit.fetch(
      pda.userDepositNative(user.publicKey),
    );
    const expected = new BN(LAMPORTS_PER_SOL / 10).add(
      new BN(LAMPORTS_PER_SOL / 20),
    );
    assert.equal(dep.amount.toString(), expected.toString());
  });

  it("set_treasury and admin withdraw SPL + SOL", async () => {
    await program.methods
      .setTreasury(treasury.publicKey)
      .accounts({
        admin: admin.publicKey,
        presaleConfig: pda.presaleConfig(),
      })
      .rpc();

    const vaultAta = getAssociatedTokenAddressSync(
      mint,
      pda.vaultAuth(),
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        mint,
        treasury.publicKey,
      )
    ).address;

    await program.methods
      .withdrawSpl(new BN(150))
      .accounts({
        admin: admin.publicKey,
        presaleConfig: pda.presaleConfig(),
        mint,
        vaultAuth: pda.vaultAuth(),
        vaultTokenAccount: vaultAta,
        treasuryTokenAccount: treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const solBalBefore = await provider.connection.getBalance(
      treasury.publicKey,
    );
    const vaultLamports = await provider.connection.getBalance(pda.solVault());
    const withdrawSol = Math.min(
      vaultLamports,
      Math.floor(LAMPORTS_PER_SOL / 50),
    );

    await program.methods
      .withdrawNativeSol(new BN(withdrawSol))
      .accounts({
        admin: admin.publicKey,
        presaleConfig: pda.presaleConfig(),
        solVault: pda.solVault(),
        treasury: treasury.publicKey,
      })
      .rpc();

    const solBalAfter = await provider.connection.getBalance(
      treasury.publicKey,
    );
    assert.isAbove(solBalAfter, solBalBefore);
  });

  it("rejects buy_spl for disallowed mint", async () => {
    const badMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6,
    );
    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      badMint,
      user.publicKey,
    );
    await mintTo(
      provider.connection,
      admin.payer,
      badMint,
      userAta.address,
      admin.publicKey,
      1000n,
    );
    const vaultAta = getAssociatedTokenAddressSync(
      badMint,
      pda.vaultAuth(),
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    let failed = false;
    try {
      await program.methods
        .buySpl(new BN(1))
        .accounts({
          presaleConfig: pda.presaleConfig(),
          user: user.publicKey,
          mint: badMint,
          userTokenAccount: userAta.address,
          vaultAuth: pda.vaultAuth(),
          vaultTokenAccount: vaultAta,
          userDeposit: pda.userDepositSpl(user.publicKey, badMint),
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("rejects withdraw from non-admin", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      mint,
      pda.vaultAuth(),
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const treasuryAta = getAssociatedTokenAddressSync(
      mint,
      treasury.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    let failed = false;
    try {
      await program.methods
        .withdrawSpl(new BN(1))
        .accounts({
          admin: user.publicKey,
          presaleConfig: pda.presaleConfig(),
          mint,
          vaultAuth: pda.vaultAuth(),
          vaultTokenAccount: vaultAta,
          treasuryTokenAccount: treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
  });
});
