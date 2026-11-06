# Why Arkiv

## If we swapped Arkiv for Postgres, what would users lose?

1. **The privacy claim.** With Postgres, every job and answer passes through a database we run. Even encrypted, users would have to trust that we don't log metadata, keep copies or quietly swap a provider's key. On Arkiv, the buyer's phone reads listings and results directly, the job is sealed before it leaves the phone, and anyone can check what is stored: it's ciphertext. "We can't read your job" becomes something users can verify, not a promise.

2. **The midnight rule, enforced by someone other than us.** Offers must die when the allowance they sell work from resets. In Postgres that's a cron job we could forget, delay or fake. On Arkiv the listing's expiry is set when it's created and the network enforces it: at 00:00 UTC it's gone for every app at once.

3. **Provider control.** Providers own their listings and results. We can't edit a provider's price, hide their offer or rewrite an answer they signed. With Postgres, we'd own all of that.

4. **An open market.** Any app or AI agent can query "the cheapest enclave translation right now" from Arkiv without our permission or an API key from us. With Postgres, the market is whatever our API chooses to expose.

5. **Surviving us.** If our server goes down, buyers can still see offers and read results already delivered, and providers keep working (they read jobs from Arkiv, not from us). New purchases need the relayer, because it pays the gas.

## What we kept off Arkiv, and why

| Kept off Arkiv | Where | Why |
|---|---|---|
| World ID nullifiers | Relayer's SQLite | Publishing them would link one person across all their wallets |
| Relay rate limits | Relayer's SQLite | Operational, private, and useless to anyone else |
| Money | Whitechain (USDT) | Arkiv is the database, not the payment rail. A job stores only the payment's transaction hash, so anyone can check it |
| Provider's 0G API key and box secret key | The provider's machine | Whoever holds these can spend the allowance or read jobs. They never leave the worker |
| Buyer's reply secret key and job history | The buyer's phone | They're what makes results readable only on that phone |
| Plaintext jobs and answers | Nowhere | They exist only on the buyer's phone and the provider's worker, in memory |
