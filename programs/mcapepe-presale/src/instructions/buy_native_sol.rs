use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::ErrorCode;
use crate::state::{native_sol_mint_marker, PresaleConfig, UserDeposit};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct BuyNativeSol<'info> {
    #[account(
        seeds = [b"config"],
        bump = presale_config.bump,
    )]
    pub presale_config: Account<'info, PresaleConfig>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"sol_vault"],
        bump
    )]
    /// CHECK: program-owned SOL vault PDA
    pub sol_vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserDeposit::SPACE,
        seeds = [b"deposit", user.key().as_ref(), b"native"],
        bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<BuyNativeSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.sol_vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let dep = &mut ctx.accounts.user_deposit;
    if dep.amount == 0 && dep.owner == Pubkey::default() {
        dep.owner = ctx.accounts.user.key();
        dep.mint = native_sol_mint_marker();
        dep.bump = ctx.bumps.user_deposit;
    } else {
        require!(dep.owner == ctx.accounts.user.key(), ErrorCode::InvalidTokenAccount);
        require!(dep.mint == native_sol_mint_marker(), ErrorCode::InvalidTokenAccount);
    }
    dep.amount = dep
        .amount
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}
