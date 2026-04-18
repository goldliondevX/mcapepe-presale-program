use anchor_lang::prelude::*;

#[event]
pub struct AllowedMintAdded {
    pub mint: Pubkey,
}

#[event]
pub struct TreasurySet {
    pub previous_treasury: Pubkey,
    pub new_treasury: Pubkey,
}

#[event]
pub struct AdminTransferred {
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
}
