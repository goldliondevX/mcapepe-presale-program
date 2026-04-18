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
        mint,
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
        user: user.publicKey,
        mint,
        userTokenAccount: userAta,
        vaultTokenAccount: vaultAta,
      })
      .signers([user])
      .rpc();

    await program.methods
      .buySpl(new BN(50))
      .accounts({
        user: user.publicKey,
        mint,
        userTokenAccount: userAta,
        vaultTokenAccount: vaultAta,
      })
      .signers([user])
      .rpc();

    const dep = await program.account.userDeposit.fetch(
      pda.userDepositSpl(user.publicKey, mint),
    );
    assert.equal(dep.amount.toString(), "150");

    const cfg = await program.account.presaleConfig.fetch(pda.presaleConfig());
    assert.equal(cfg.totalSplDeposited[0].toString(), "150");
  });

  it("buy_native_sol accumulates native deposit", async () => {
    await program.methods
      .buyNativeSol(new BN(LAMPORTS_PER_SOL / 10))
      .accounts({
        user: user.publicKey,
      })
      .signers([user])
      .rpc();

    await program.methods
      .buyNativeSol(new BN(LAMPORTS_PER_SOL / 20))
      .accounts({
        user: user.publicKey,
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

    const cfg = await program.account.presaleConfig.fetch(pda.presaleConfig());
    assert.equal(cfg.totalNativeSolDeposited.toString(), expected.toString());
  });

  it("set_treasury and admin withdraw SPL + SOL", async () => {
    await program.methods
      .setTreasury(treasury.publicKey)
      .accounts({
        admin: admin.publicKey,
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

    const totalsBefore = await program.account.presaleConfig.fetch(
      pda.presaleConfig(),
    );

    await program.methods
      .withdrawSpl()
      .accounts({
        admin: admin.publicKey,
        mint,
        vaultTokenAccount: vaultAta,
        treasuryTokenAccount: treasuryAta,
      })
      .rpc();

    const solBalBefore = await provider.connection.getBalance(
      treasury.publicKey,
    );

    await program.methods
      .withdrawNativeSol()
      .accounts({
        admin: admin.publicKey,
        treasury: treasury.publicKey,
      })
      .rpc();

    const solBalAfter = await provider.connection.getBalance(
      treasury.publicKey,
    );
    assert.isAbove(solBalAfter, solBalBefore);

    const totalsAfter = await program.account.presaleConfig.fetch(
      pda.presaleConfig(),
    );
    assert.equal(
      totalsAfter.totalSplDeposited[0].toString(),
      totalsBefore.totalSplDeposited[0].toString(),
    );
    assert.equal(
      totalsAfter.totalNativeSolDeposited.toString(),
      totalsBefore.totalNativeSolDeposited.toString(),
    );
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
          user: user.publicKey,
          mint: badMint,
          userTokenAccount: userAta.address,
          vaultTokenAccount: vaultAta,
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
        .withdrawSpl()
        .accounts({
          admin: user.publicKey,
          mint,
          vaultTokenAccount: vaultAta,
          treasuryTokenAccount: treasuryAta,
        })
        .signers([user])
        .rpc();
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("transfer_admin moves authority and restores", async () => {
    const newAdmin = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      newAdmin.publicKey,
      LAMPORTS_PER_SOL / 10,
    );
    await provider.connection.confirmTransaction(sig);

    await program.methods
      .transferAdmin(newAdmin.publicKey)
      .accounts({ admin: admin.publicKey })
      .rpc();

    let cfg = await program.account.presaleConfig.fetch(pda.presaleConfig());
    assert.equal(cfg.admin.toBase58(), newAdmin.publicKey.toBase58());

    let oldAdminBlocked = false;
    try {
      await program.methods
        .setTreasury(treasury.publicKey)
        .accounts({ admin: admin.publicKey })
        .rpc();
    } catch {
      oldAdminBlocked = true;
    }
    assert.isTrue(oldAdminBlocked);

    await program.methods
      .transferAdmin(admin.publicKey)
      .accounts({ admin: newAdmin.publicKey })
      .signers([newAdmin])
      .rpc();

    cfg = await program.account.presaleConfig.fetch(pda.presaleConfig());
    assert.equal(cfg.admin.toBase58(), admin.publicKey.toBase58());
  });
});
