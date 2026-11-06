# Arkiv friction log

Written as we hit things building at ETHGlobal Mumbai, Nov 5 to 7, 2026, with `@arkiv-network/sdk` 1.0.1 on rabdi testnet. The first four came up in our earlier build the same weekend and still apply.

## What should Arkiv improve today?

### 1. Writes are the slowest part of our app (about 7 seconds each)
- One paid job needs two writes (the `Job` by the relayer, the `Result` by the provider). Of a 23-second end-to-end job, roughly 14 seconds is waiting on those two `createEntity` calls; 0G inference is 6 to 10 seconds; reads are 330 to 440 ms.
- **Ask:** a way to get notified the moment a write is in the mempool or included, or faster confirmation for small entities, so apps can show progress sooner.

### 2. Concurrent writes from one key fail with an opaque error
- **Did:** two `createEntity` calls at the same time from the same account.
- **Expected:** both land, or a clear nonce error.
- **Got:** `EntityMutationError: Transaction failed: Execution error without revert data`, caused by `ContractFunctionExecutionError: Missing or invalid parameters`. Nothing pointed at the nonce.
- **Reproduce:** run two `createEntity` calls concurrently with the same wallet client.
- **Workaround:** every key in our app writes through a serial queue (`serialQueue` in `shared/clients.mjs`).
- **Ask:** nonce management per account in the SDK, or map this RPC error to a "nonce conflict" message.

### 3. Error messages include the access key
- The error's `URL:` line prints the full RPC URL, and the access key is a path segment (`.../ark_live_...`). Anyone who pastes an error into Discord or an issue leaks their key. It happened to us while debugging.
- **Ask:** redact the key in errors, or accept it as a header instead of a path segment.

### 4. No event when an entity expires
- Expiry is the heart of Last Call, but `watchEntityEvents` has no expired event. Our UI computes every countdown itself from `$expiresAt` and the 2-second block time.
- **Ask:** `onEntityExpired`, or a subscription for "entities expiring within N blocks".

### 5. `$createdAt` can't be sorted on
- We want "newest jobs first" from the node. We select `$createdAt` and sort in the client instead.

### 6. Every column comes back wrapped in `{ value }`
- `select` rows and `getEntity` both return columns as `{ value }` objects alongside `$`-prefixed fields, and we flatten them in three places (`flat()` in the web app, a map in the relayer, another in the e2e script). Easy to forget `.value`, and the error you get is a confusing comparison failure, not a type error, in plain JS.
- **Ask:** an option like `.fetch({ flat: true })` that returns plain values.

### 7. Writing a `key` column needs `key(...)`, and the error only shows at write time
- **Did:** passed a 0x-prefixed 32-byte hex string for a `key()` column.
- **Got:** `Column "stallKey": a key column, but the value is a str. Write key(...) around the value.` A clear message, but it surfaced only after a USDT payment had already settled, so a sale was paid and not recorded.
- **Ask:** accept a 32-byte hex string for `key` columns, or validate payloads before the app does other work (a `Stall.parse(values)` helper).

### 8. Private data needs encryption you build yourself
- Every entity is public, which is right, but most "AI marketplace" data is sensitive. We added X25519 sealed boxes (libsodium) for `input` and `output`.
- **Ask:** a small official helper for "bytes sealed to a public key", plus guidance on key handling, so every team doesn't reinvent it and get it subtly wrong.

### 9. Expiring at a calendar time is great
- `ExpirationTime.atDate(next 00:00 UTC)` did exactly what we needed with one line. Not friction, but worth keeping exactly as it is.

## When something broke: expected, happened, reproduce

| Expected | Happened | Reproduce |
|---|---|---|
| Two parallel writes from one key both land | One fails with "Missing or invalid parameters" | Two concurrent `createEntity` calls, same wallet client |
| A `key()` column accepts a 32-byte hex string | `a key column, but the value is a str` | `createEntity(S, { someKey: "0x" + "ab".repeat(32) })` where `someKey: key()` |
| Error output safe to paste publicly | Access key printed in the error's URL line | Any failing call with `rabdi({ accessKey })` |
