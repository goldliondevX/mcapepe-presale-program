use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::state::PresaleConfig;

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = presale_config.bump,
        constraint = presale_config.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub presale_config: Account<'info, PresaleConfig>,

    pub mint: Account<'info, Mint>,

    /// CHECK: vault authority PDA
    #[account(seeds = [b"vault_auth"], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault_token_account.mint == mint.key() @ ErrorCode::InvalidVault,
        constraint = vault_token_account.owner == vault_auth.key() @ ErrorCode::InvalidVault,
        constraint = vault_token_account.key() == anchor_spl::associated_token::get_associated_token_address(&vault_auth.key(), &mint.key()) @ ErrorCode::InvalidVault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_token_account.mint == mint.key() @ ErrorCode::InvalidVault,
        constraint = treasury_token_account.owner == presale_config.treasury @ ErrorCode::InvalidTreasury,
        constraint = treasury_token_account.key() == anchor_spl::associated_token::get_associated_token_address(&presale_config.treasury, &mint.key()) @ ErrorCode::InvalidTreasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<WithdrawSpl>) -> Result<()> {
    require!(
        ctx.accounts.presale_config.treasury != Pubkey::default(),
        ErrorCode::InvalidTreasury
    );

    let amount = ctx.accounts.vault_token_account.amount;
    require!(amount > 0, ErrorCode::NothingToWithdraw);

    let bump = ctx.bumps.vault_auth;
    let seeds: &[&[u8]] = &[b"vault_auth", &[bump]];
    let signer = &[seeds];

    let cpi = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.treasury_token_account.to_account_info(),
        authority: ctx.accounts.vault_auth.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi,
            signer,
        ),
        amount,
    )?;

    Ok(())
}
