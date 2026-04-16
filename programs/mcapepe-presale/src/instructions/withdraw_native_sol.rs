use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::PresaleConfig;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawNativeSol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = presale_config.bump,
        constraint = presale_config.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub presale_config: Account<'info, PresaleConfig>,

    #[account(mut, seeds = [b"sol_vault"], bump)]
    /// CHECK: SOL vault PDA (program-owned); lamports moved without SystemProgram transfer CPI
    pub sol_vault: AccountInfo<'info>,

    /// CHECK: treasury wallet receives lamports
    #[account(mut, constraint = treasury.key() == presale_config.treasury @ ErrorCode::InvalidTreasury)]
    pub treasury: AccountInfo<'info>,
}

pub(crate) fn handler(ctx: Context<WithdrawNativeSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(
        ctx.accounts.presale_config.treasury != Pubkey::default(),
        ErrorCode::InvalidTreasury
    );

    let vault = ctx.accounts.sol_vault.to_account_info();
    let treasury = ctx.accounts.treasury.to_account_info();
    require!(vault.lamports() >= amount, ErrorCode::InvalidAmount);

    **vault.try_borrow_mut_lamports()? -= amount;
    **treasury.try_borrow_mut_lamports()? += amount;

    Ok(())
}
