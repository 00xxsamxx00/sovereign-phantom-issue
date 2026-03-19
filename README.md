# Phantom Wallet Multisig Signing — Minimal Reproduction

Reproduces the issue where Phantom wallet cannot sign a sovereign-sdk multisig transaction.

## What this does

The [original integration test](../sovereign-sdk/typescript/packages/multisig/tests/multisig.integration-test.ts) uses `Ed25519Signer` (raw private key access via `@noble/ed25519`) to sign transactions. This repo replaces that with a **Phantom wallet** connected via `@solana/wallet-adapter-react`.

### The adapter (`PhantomSigner`)

```ts
// Wraps Phantom's wallet.signMessage() to implement the sovereign-sdk Signer interface:
//   sign(message: Uint8Array): Promise<Uint8Array>
//   publicKey(): Promise<Uint8Array>
```

### The signing flow

In `rollup.signTransaction()`, the SDK:
1. Serializes the unsigned transaction via Borsh (`serializer.serializeUnsignedTx`)
2. Fetches the chain hash
3. Concatenates them: `signer.sign(new Uint8Array([...serializedTx, ...chainHash]))`

With `Ed25519Signer`, step 3 calls `@noble/ed25519.signAsync(message, privateKey)` directly — raw Ed25519 signing.

With `PhantomSigner`, step 3 calls `wallet.signMessage(message)` — which goes through Phantom's signing flow.

## Setup

```bash
npm install
npm run dev
```

## Steps to reproduce

1. Open the app in browser (with Phantom extension installed)
2. Click "Select Wallet" → connect Phantom
3. Click "Init Rollup" (requires a running sovereign rollup node)
4. Click "Sign & Submit" — observe the error
