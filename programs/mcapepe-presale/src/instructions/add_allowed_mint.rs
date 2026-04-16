use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token};
use anchor_spl::token;

use crate::errors::ErrorCode;
use crate::state::PresaleConfig;

#[derive(Accounts)]
pub struct AddAllowedMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = presale_config.bump,
        constraint = presale_config.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub presale_config: Account<'info, PresaleConfig>,

    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority for all vault token accounts
    #[account(seeds = [b"vault_auth"], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = vault_auth,
    )]
    pub vault_token_account: Account<'info, token::TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<AddAllowedMint>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    require!(mint_key != Pubkey::default(), ErrorCode::InvalidMint);
    ctx.accounts.presale_config.try_add_mint(mint_key)?;
    Ok(())
}
