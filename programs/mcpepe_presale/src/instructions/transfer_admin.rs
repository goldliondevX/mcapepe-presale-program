use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::events::AdminTransferred;
use crate::state::PresaleConfig;

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = presale_config.bump,
        constraint = presale_config.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub presale_config: Account<'info, PresaleConfig>,
}

pub(crate) fn handler(ctx: Context<TransferAdmin>, new_admin: Pubkey) -> Result<()> {
    require!(new_admin != Pubkey::default(), ErrorCode::InvalidAdmin);
    require!(
        new_admin != ctx.accounts.presale_config.admin,
        ErrorCode::SameAdmin
    );

    let previous_admin = ctx.accounts.presale_config.admin;
    ctx.accounts.presale_config.admin = new_admin;

    emit!(AdminTransferred {
        previous_admin,
        new_admin,
    });
    Ok(())
}
