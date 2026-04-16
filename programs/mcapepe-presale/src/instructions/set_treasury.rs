use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::PresaleConfig;

#[derive(Accounts)]
pub struct SetTreasury<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = presale_config.bump,
        constraint = presale_config.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub presale_config: Account<'info, PresaleConfig>,
}

pub(crate) fn handler(ctx: Context<SetTreasury>, new_treasury: Pubkey) -> Result<()> {
    require!(new_treasury != Pubkey::default(), ErrorCode::InvalidTreasury);
    ctx.accounts.presale_config.treasury = new_treasury;
    Ok(())
}
