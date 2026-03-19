import type { Signer } from "@sovereign-sdk/signers";
import type { WalletContextState } from "@solana/wallet-adapter-react";

/**
 * Wraps a connected Phantom wallet (via @solana/wallet-adapter-react)
 * to implement the sovereign-sdk Signer interface.
 *
 * The sovereign-sdk Signer interface expects:
 *   sign(message: Uint8Array): Promise<Uint8Array>
 *   publicKey(): Promise<Uint8Array>
 *
 * Phantom's signMessage also takes Uint8Array and returns Uint8Array,
 * so this should be a straightforward adapter — but this is where
 * the issue manifests.
 */
export class PhantomSigner implements Signer {
  private wallet: WalletContextState;

  constructor(wallet: WalletContextState) {
    if (!wallet.connected || !wallet.publicKey || !wallet.signMessage) {
      throw new Error("Wallet must be connected and support signMessage");
    }
    this.wallet = wallet;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    if (!this.wallet.signMessage) {
      throw new Error("Wallet does not support signMessage");
    }
    // Phantom's signMessage signs arbitrary bytes using Ed25519
    // This is passed directly to rollup.signTransaction which calls:
    //   signer.sign(new Uint8Array([...serializedUnsignedTx, ...chainHash]))
    const signature = await this.wallet.signMessage(message);
    return signature;
  }

  async publicKey(): Promise<Uint8Array> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    return this.wallet.publicKey.toBytes();
  }
}
