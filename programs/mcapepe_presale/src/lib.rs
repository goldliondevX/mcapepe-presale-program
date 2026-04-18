use anchor_lang::prelude::*;

mod consts;
mod errors;
mod events;
mod instructions;
mod state;

pub use instructions::*;
pub use state::*;

declare_id!("4ZD9bhpiwwaL1hxutSmW2hcHaAVzru28niPXhqXrEjLP");

#[program]
pub mod mcapepe_presale {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn set_treasury(ctx: Context<SetTreasury>, new_treasury: Pubkey) -> Result<()> {
        instructions::set_treasury::handler(ctx, new_treasury)
    }

    pub fn transfer_admin(ctx: Context<TransferAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::transfer_admin::handler(ctx, new_admin)
    }

    pub fn add_allowed_mint(ctx: Context<AddAllowedMint>) -> Result<()> {
        instructions::add_allowed_mint::handler(ctx)
    }

    pub fn buy_spl(ctx: Context<BuySpl>, amount: u64) -> Result<()> {
        instructions::buy_spl::handler(ctx, amount)
    }

    pub fn buy_native_sol(ctx: Context<BuyNativeSol>, amount: u64) -> Result<()> {
        instructions::buy_native_sol::handler(ctx, amount)
    }

    pub fn withdraw_spl(ctx: Context<WithdrawSpl>) -> Result<()> {
        instructions::withdraw_spl::handler(ctx)
    }

    pub fn withdraw_native_sol(ctx: Context<WithdrawNativeSol>) -> Result<()> {
        instructions::withdraw_native_sol::handler(ctx)
    }
}
