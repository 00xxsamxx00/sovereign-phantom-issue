import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { bytesToHex } from "@sovereign-sdk/utils";
import type { RollupSchema } from "@sovereign-sdk/serializers";
import { WasmSerializer } from "@sovereign-sdk/serializers/wasm";
import {
  DEFAULT_TX_DETAILS,
  type StandardRollup,
  createStandardRollup,
} from "@sovereign-sdk/web3";
import type { UnsignedTransaction } from "@sovereign-sdk/types";
import { MultisigTransaction } from "@sovereign-sdk/multisig";
import { PhantomSigner } from "./PhantomSigner";
import { Client, type RuntimeCall } from "@bulletxyz/bullet-sdk";
import { BulletWallet } from "./wallet";

/**
 * Minimal reproduction of the Phantom wallet multisig signing issue.
 *
 * Original test flow (works with Ed25519Signer):
 *   1. generateSigners(3) — creates Ed25519Signer instances with raw private keys
 *   2. rollup.signTransaction(unsignedTx, signer) — for each signer
 *   3. MultisigTransaction.fromTransactions({ txns, minSigners, allPubKeys })
 *   4. rollup.submitTransaction(multisig.asTransaction())
 *
 * This component replaces step 1 with a Phantom wallet connected via UI.
 * The PhantomSigner wraps wallet.signMessage to implement the Signer interface.
 */
export function MultisigTest() {
  const wallet = useWallet();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [rollup, setRollup] = useState<StandardRollup<any> | null>(null);

  const initRollup = async () => {
    try {
      setStatus("Initializing rollup...");
      const client = await Client.fromNetwork(
        "mainnet",
        new BulletWallet(wallet),
        undefined,
        {
          authenticator: "solanaAuto",
        },
      );
      const r = await createStandardRollup<RuntimeCall>({
        url: client.endpoint,
        getSerializer: (schema: RollupSchema) => new WasmSerializer(schema),
        context: client.rollup.context,
      });
      setRollup(r);
      setStatus("Rollup initialized. Ready to sign.");
    } catch (e: any) {
      setError(`Failed to init rollup: ${e.message}`);
    }
  };

  const signAndSubmit = async () => {
    if (!rollup) {
      setError("Initialize rollup first");
      return;
    }

    if (!wallet.connected || !wallet.publicKey || !wallet.signMessage) {
      setError("Connect Phantom wallet first (must support signMessage)");
      return;
    }

    try {
      setError("");
      setStatus("Creating PhantomSigner...");

      const phantomSigner = new PhantomSigner(wallet);
      const pubKeyBytes = await phantomSigner.publicKey();
      const pubKeyHex = bytesToHex(pubKeyBytes);

      setStatus(`Signer public key: ${pubKeyHex.slice(0, 16)}...`);

      // Build the same unsigned transaction as the integration test
      const constants = await rollup.rollup.constants();
      const chain_id = constants.chain_id;

      const runtime_call = {
        exchange: {
          keeper: {
            update_user_fee_tier: {
              address: "3ycjQyyPo4fbspaMnG5eYTv8RYgacNbrzyBNmBeCpfVM",
              fee_tier: "tier_0",
            },
          },
        },
      };

      const unsignedTx: UnsignedTransaction<any> = {
        runtime_call,
        uniqueness: { nonce: 0 },
        details: { ...DEFAULT_TX_DETAILS, chain_id },
      };

      setStatus("Requesting Phantom to sign transaction...");

      // THIS IS WHERE THE ISSUE OCCURS:
      // rollup.signTransaction calls signer.sign(serializedTx + chainHash)
      // which delegates to wallet.signMessage(bytes)
      //
      // With Ed25519Signer: sign() uses @noble/ed25519 directly — works fine
      // With PhantomSigner: sign() uses wallet.signMessage() — may fail or
      // produce a signature that doesn't verify on-chain
      const signedTx = await rollup.signTransaction(unsignedTx, phantomSigner);

      setStatus("Transaction signed! Building multisig...");

      // For a single-signer multisig (minSigners=1) to keep it minimal
      const multisig = MultisigTransaction.fromTransactions({
        txns: [signedTx],
        minSigners: 1,
        allPubKeys: [pubKeyHex],
      });

      setStatus("Submitting multisig transaction...");

      const response = await rollup.submitTransaction(multisig.asTransaction());

      setStatus(`Result: ${JSON.stringify(response)}`);
    } catch (e: any) {
      console.error("Multisig signing failed:", e);
      setError(`Error: ${e.message}\n\nStack: ${e.stack}`);
      setStatus("Failed — see error below");
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
      <h1>Phantom Multisig Repro</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Reproduces the issue where Phantom wallet cannot sign a sovereign-sdk
        multisig transaction. Replaces <code>generateSigners</code> /
        <code>Ed25519Signer</code> with <code>PhantomSigner</code> wrapping
        <code> wallet.signMessage()</code>.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={initRollup} disabled={!!rollup}>
          1. Init Rollup
        </button>
        <button onClick={signAndSubmit} disabled={!rollup || !wallet.connected}>
          2. Sign & Submit
        </button>
      </div>

      {status && (
        <pre
          style={{
            background: "#f0f0f0",
            padding: 12,
            borderRadius: 4,
            whiteSpace: "pre-wrap",
          }}
        >
          {status}
        </pre>
      )}

      {error && (
        <pre
          style={{
            background: "#fee",
            color: "#c00",
            padding: 12,
            borderRadius: 4,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </pre>
      )}
    </div>
  );
}
