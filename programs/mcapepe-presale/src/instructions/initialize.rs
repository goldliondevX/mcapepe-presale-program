use anchor_lang::prelude::*;

use crate::state::PresaleConfig;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + PresaleConfig::SPACE,
        seeds = [b"config"],
        bump
    )]
    pub presale_config: Account<'info, PresaleConfig>,

    #[account(
        init,
        payer = admin,
        space = 0,
        seeds = [b"sol_vault"],
        bump
    )]
    /// CHECK: zero-byte PDA holding native SOL for the presale
    pub sol_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<Initialize>) -> Result<()> {
    let cfg = &mut ctx.accounts.presale_config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.treasury = ctx.accounts.admin.key();
    cfg.bump = ctx.bumps.presale_config;
    cfg.allowed_mints = [Pubkey::default(); crate::consts::MAX_ALLOWED_MINTS];
    cfg.allowed_mints_len = 0;

    Ok(())
}
