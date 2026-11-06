# Reach

## Who is it for, and would they use it?

**Providers: anyone holding spare AI compute that expires.**
0G gives iAI stakers fresh compute credits every day (1.271 credits per staked iAI), and 0G's own ETHGlobal Mumbai brief says unused credits expire at 00:00 UTC, "so thousands go to waste daily". A provider runs one command (`pnpm worker`) and their spare allowance starts doing paid work instead of disappearing. Their marginal cost near midnight is zero, so any sale is upside.

**Buyers: people who need one AI job, not a subscription.**
A student translating a notice into Malayalam, a shop owner summarizing a supplier contract, someone transcribing a voice note. A ChatGPT Plus subscription costs about $20 a month; on Last Call a job costs cents, falling toward midnight, with no account, wallet or gas.

**Agents: software that buys AI jobs.**
Listings are public Arkiv entities, so an agent can query "cheapest enclave translation right now" and buy through the same relayer without a human. Nothing in the flow needs a person except the one-time World ID check for the welcome balance.

## Can they try it today?

Yes:

- **At the booth:** scan the QR code, verify with World ID (staging simulator), get test USDT, and buy a translation, summary or transcript on your own phone.
- **From the repo:** `pnpm e2e` runs a full paid job against the live testnets in about 25 seconds. `pnpm worker` makes you a provider.
- **On Arkiv right now:** 3 live listings, 4 paid jobs and 4 delivered results in market `ethglobal-mumbai` (query in [how-you-use-arkiv.md](how-you-use-arkiv.md)).

## Will we keep building it after Mumbai?

What we'd ship next, in order:

1. **Host it:** web app on Vercel, relayer on our existing Oracle VM, so anyone can try it without the booth.
2. **More providers:** a one-command install for iAI holders, with their own prices and capacity.
3. **The real business model:** a 10% take rate, prepaid buyer balances settled in batches (one gas payment per top-up instead of per job), and an API for apps and agents buying unused capacity in bulk.
4. **Ownership hand-off:** `changeOwnership` of each `Job` to its buyer once the result lands, so even the relayer can't delete the record.
