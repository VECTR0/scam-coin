import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { AES, Asymetric, Crypto, KeyPair } from './util';
import { join } from 'path';

type Identity = {
  address: string;
  keyPair: KeyPair;
};

type WalletStringify = {
  uuid: string;
  identities: Identity[];
  saveCounter: number;
};

class Wallet {
  private static instance: Wallet; // Singleton

  uuid?: string;
  private password?: string;
  private identities: Identity[] = [];
  private saveCounter: number = 0;
  private filename: string | undefined = undefined;

  constructor() {}

  public static getInstance(): Wallet {
    if (!this.instance) {
      this.instance = new Wallet();
    }
    return this.instance;
  }

  reset(): void {
    this.uuid = undefined;
    this.password = undefined;
    this.identities = [];
    this.saveCounter = 0;
  }

  loadFromFile(filename: string, password: string): void {
    try {
      const filenamePath = this.getPath(filename);
      const encryptedData = readFileSync(filenamePath, { encoding: 'utf-8' });
      const decryptedData = AES.decrypt(encryptedData, password);
      const walletData = JSON.parse(decryptedData) as WalletStringify;
      //   TODO: some checks comparing currently loaded wallet with the one loaded from disk (timestamps, etc)

      const { uuid, identities, saveCounter } = walletData;
      this.password = password;
      this.identities = identities || [];
      this.uuid = uuid;
      this.saveCounter = saveCounter;
      this.filename = filename;
    } catch {
      throw new Error('Failed to load wallet.');
    }
  }

  saveToFile(filename: string, password: string): void {
    const { uuid, identities, saveCounter } = this;
    const walletData = {
      uuid,
      identities,
      saveCounter,
    } as WalletStringify;

    const encryptedData = AES.encrypt(JSON.stringify(walletData), password);
    const filenamePath = this.getPath(filename);

    writeFileSync(filenamePath, encryptedData, { encoding: 'utf-8' });
    this.saveCounter++;
  }

  create(password: string): void {
    this.password = password;
    this.uuid = randomUUID();
    this.saveCounter = 0;
    this.identities = [];
  }

  createIdentity() {
    if (!this.password || !this.filename) {
      throw new Error(
        'No wallet is loaded. Please create or load a wallet first.',
      );
    }

    const keyPair = Asymetric.genKeyPair();
    const address = Crypto.getAddressesFromPublicKey(keyPair.publicKey);
    const identity: Identity = {
      address,
      keyPair,
    };

    this.identities.push(identity);
    this.saveToFile(this.filename, this.password);
  }

  getPath(filename: string): string {
    return join(__dirname, '../wallets', filename);
  }

  getIdentities(): Identity[] {
    return this.identities;
  }

  setPassword(password?: string): void {
    this.password = password;
  }
}

export default Wallet;
