use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Signer is not the presale admin")]
    Unauthorized,
    #[msg("Treasury address must be set to a non-default pubkey before withdrawals")]
    InvalidTreasury,
    #[msg("This SPL mint is not allowed for presale")]
    MintNotAllowed,
    #[msg("Allowed mints list is full")]
    MintListFull,
    #[msg("Mint is already allowed")]
    MintAlreadyAllowed,
    #[msg("Amount must be positive")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid token account for this user or mint")]
    InvalidTokenAccount,
    #[msg("Invalid mint address")]
    InvalidMint,
    #[msg("Vault token account mint mismatch")]
    InvalidVault,
    #[msg("Nothing to withdraw: vault is empty")]
    NothingToWithdraw,
}
