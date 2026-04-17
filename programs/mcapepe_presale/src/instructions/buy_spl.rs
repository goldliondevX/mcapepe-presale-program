use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::state::{PresaleConfig, UserDeposit};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct BuySpl<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = presale_config.bump,
    )]
    pub presale_config: Account<'info, PresaleConfig>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ ErrorCode::InvalidTokenAccount,
        constraint = user_token_account.mint == mint.key() @ ErrorCode::InvalidTokenAccount,
        constraint = user_token_account.key() == anchor_spl::associated_token::get_associated_token_address(&user.key(), &mint.key()) @ ErrorCode::InvalidTokenAccount,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

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
        init_if_needed,
        payer = user,
        space = 8 + UserDeposit::SPACE,
        seeds = [b"deposit", user.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<BuySpl>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    let mint_key = ctx.accounts.mint.key();
    require!(
        ctx.accounts.presale_config.is_mint_allowed(&mint_key),
        ErrorCode::MintNotAllowed
    );

    let cpi = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
        amount,
    )?;

    let dep = &mut ctx.accounts.user_deposit;
    if dep.amount == 0 && dep.owner == Pubkey::default() {
        dep.owner = ctx.accounts.user.key();
        dep.mint = mint_key;
        dep.bump = ctx.bumps.user_deposit;
    } else {
        require!(dep.owner == ctx.accounts.user.key(), ErrorCode::InvalidTokenAccount);
        require!(dep.mint == mint_key, ErrorCode::InvalidTokenAccount);
    }
    dep.amount = dep
        .amount
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    let slot = ctx
        .accounts
        .presale_config
        .mint_slot_index(&mint_key)
        .ok_or(ErrorCode::MintNotAllowed)?;
    ctx.accounts.presale_config.total_spl_deposited[slot] = ctx.accounts.presale_config.total_spl_deposited[slot]
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}
