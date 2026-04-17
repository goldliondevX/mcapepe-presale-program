use anchor_lang::prelude::*;

use crate::consts::MAX_ALLOWED_MINTS;

/// Marker stored on `UserDeposit.mint` for native SOL (no SPL mint).
#[inline]
pub fn native_sol_mint_marker() -> Pubkey {
    Pubkey::default()
}

#[account]
pub struct PresaleConfig {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub bump: u8,
    pub allowed_mints: [Pubkey; MAX_ALLOWED_MINTS],
    pub allowed_mints_len: u8,
    /// Cumulative native SOL sent into the presale via `buy_native_sol` (never reduced on withdraw).
    pub total_native_sol_deposited: u64,
    /// Per allowed-mint slot: cumulative SPL deposited for that mint (never reduced on withdraw).
    pub total_spl_deposited: [u64; MAX_ALLOWED_MINTS],
}

impl PresaleConfig {
    pub const SPACE: usize = 32
        + 32
        + 1
        + (32 * MAX_ALLOWED_MINTS)
        + 1
        + 8
        + (8 * MAX_ALLOWED_MINTS);

    pub fn is_mint_allowed(&self, mint: &Pubkey) -> bool {
        let n = self.allowed_mints_len as usize;
        self.allowed_mints[..n].iter().any(|m| m == mint)
    }

    pub fn mint_slot_index(&self, mint: &Pubkey) -> Option<usize> {
        let n = self.allowed_mints_len as usize;
        self.allowed_mints[..n].iter().position(|m| m == mint)
    }

    pub fn try_add_mint(&mut self, mint: Pubkey) -> Result<()> {
        require!(
            (self.allowed_mints_len as usize) < MAX_ALLOWED_MINTS,
            crate::errors::ErrorCode::MintListFull
        );
        let n = self.allowed_mints_len as usize;
        require!(
            !self.allowed_mints[..n].iter().any(|m| *m == mint),
            crate::errors::ErrorCode::MintAlreadyAllowed
        );
        self.allowed_mints[n] = mint;
        self.allowed_mints_len = self
            .allowed_mints_len
            .checked_add(1)
            .ok_or(crate::errors::ErrorCode::Overflow)?;
        Ok(())
    }
}

/// Cumulative amount paid by `owner` for one asset: SPL mint pubkey, or native SOL (`mint == native_sol_mint_marker()`).
#[account]
pub struct UserDeposit {
    pub owner: Pubkey,
    /// SPL mint, or `NATIVE_SOL_MINT_PLACEHOLDER` for lamports tracked under the native seed branch.
    pub mint: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

impl UserDeposit {
    pub const SPACE: usize = 32 + 32 + 8 + 1;
}
