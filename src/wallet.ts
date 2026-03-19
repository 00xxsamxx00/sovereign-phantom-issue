import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Wallet, base58ToHex } from "@bulletxyz/bullet-sdk";

export class BulletWallet extends Wallet {
  readonly walletContext: WalletContextState;

  constructor(walletContext: WalletContextState) {
    if (!walletContext.publicKey) {
      throw new Error("Wallet must be connected with a public key");
    }
    super(base58ToHex(walletContext.publicKey.toBase58()));
    this.walletContext = walletContext;
  }

  public async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.walletContext.signMessage) {
      throw new Error("Wallet does not support message signing");
    }
    return this.walletContext.signMessage(message);
  }

  public getSigner() {
    return {
      sign: (message: Uint8Array) =>
        this.signMessage(new Uint8Array([...message])),
      publicKey: async () => {
        if (!this.walletContext.publicKey) {
          throw new Error("Wallet not connected");
        }
        const hex = base58ToHex(this.walletContext.publicKey.toBase58());
        const bytes = new Uint8Array(
          hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
        );

        if (bytes.length !== 32) {
          throw new Error(
            `Invalid public key length: ${bytes.length} bytes. Expected 32 bytes.`,
          );
        }

        return bytes;
      },
    };
  }

  public get icon() {
    return this.walletContext.wallet?.adapter.icon;
  }
}
