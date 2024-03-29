import type { Commitment, ConfirmOptions, Connection, PublicKey, Signer } from '@solana/web3.js';
import { ComputeBudgetProgram, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
    TokenAccountNotFoundError,
    TokenInvalidAccountOwnerError,
    TokenInvalidMintError,
    TokenInvalidOwnerError,
} from '@solana/spl-token';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import type { Account } from '@solana/spl-token';
import { getAccount } from '@solana/spl-token';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

interface IGetOrCreateParams {
    connection: Connection,
    payer: Signer,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    computePrice?: number,
    commitment?: Commitment,
    confirmOptions?: ConfirmOptions,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
}

interface ICreateParams {
    connection: Connection,
    payer: Signer,
    mint: PublicKey,
    owner: PublicKey,
    associatedToken: PublicKey,
    computePrice?: number,
    commitment?: Commitment,
    confirmOptions?: ConfirmOptions,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
}

export async function createAssociatedTokenAccount(
    {
        connection,
        payer,
        mint,
        owner,
        associatedToken,
        computePrice,
        commitment,
        confirmOptions,
        programId = TOKEN_PROGRAM_ID,
        associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
    }: ICreateParams
): Promise<Account> {
    try {
        const transaction = new Transaction();

        if (computePrice) {
            transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computePrice }));
        }

        transaction.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                associatedToken,
                owner,
                mint,
                programId,
                associatedTokenProgramId
            )
        );

        await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
    } catch (error: unknown) {
        // Ignore all errors; for now there is no API-compatible way to selectively ignore the expected
        // instruction error if the associated account exists already.
    }
    return getAccount(connection, associatedToken, commitment, programId);
}

export async function getOrCreateAssociatedTokenAccount(
    {
        connection,
        payer,
        mint,
        owner,
        allowOwnerOffCurve,
        computePrice,
        commitment,
        confirmOptions,
        programId = TOKEN_PROGRAM_ID,
        associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
    }: IGetOrCreateParams
): Promise<Account> {
    const associatedToken = getAssociatedTokenAddressSync(
        mint,
        owner,
        allowOwnerOffCurve,
        programId,
        associatedTokenProgramId
    );

    // This is the optimal logic, considering TX fee, client-side computation, RPC roundtrips and guaranteed idempotent.
    // Sadly we can't do this atomically.
    let account: Account;
    try {
        account = await getAccount(connection, associatedToken, commitment, programId);
    } catch (error: unknown) {
        // TokenAccountNotFoundError can be possible if the associated address has already received some lamports,
        // becoming a system account. Assuming program derived addressing is safe, this is the only case for the
        // TokenInvalidAccountOwnerError in this code path.
        if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
            account = await createAssociatedTokenAccount({ connection, payer, mint, owner, associatedToken, computePrice, commitment, confirmOptions, programId, associatedTokenProgramId })
        } else {
            throw error;
        }
    }

    if (!account.mint.equals(mint)) throw new TokenInvalidMintError();
    if (!account.owner.equals(owner)) throw new TokenInvalidOwnerError();

    return account;
}