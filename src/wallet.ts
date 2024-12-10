import { createPrivateKey, createPublicKey, privateDecrypt, randomUUID } from 'crypto';
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

  constructor() { }

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
      const walletJSONData = JSON.parse(decryptedData);
      const walletData: WalletStringify = {
        uuid: walletJSONData.uuid,
        identities: walletJSONData.identities.map((i: any) => {
          const keyPair = {
            publicKey: createPublicKey(i.publicKey),
            privateKey: createPrivateKey(i.privateKey),
          } as KeyPair;

          const identity: Identity = {
            address: i.address,
            keyPair,
          };

          return identity;
        }
        ),
        saveCounter: walletJSONData.saveCounter,
      }

      //   TODO: some checks comparing currently loaded wallet with the one loaded from disk (timestamps, etc)
      this.reset();

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

    const walletDataJSONizableObject = {
      uuid: uuid,
      identities: identities.map((i) => ({
        address: i.address,
        publicKey: i.keyPair.publicKey.export({
          type: 'spki',
          format: 'pem',
        }) as string,
        privateKey: i.keyPair.privateKey.export({
          type: 'pkcs8',
          format: 'pem',
        }) as string,
      })),
      saveCounter: saveCounter,
    }

    const walletDataString = JSON.stringify(walletDataJSONizableObject);
    const encryptedData = AES.encrypt(walletDataString, password);
    const filenamePath = this.getPath(filename);

    writeFileSync(filenamePath, encryptedData, { encoding: 'utf-8' });
    this.saveCounter++;
  }

  create(): void {
    this.uuid = randomUUID();
    this.saveCounter = 0;
    this.identities = [];
  }

  createIdentity() {
    const keyPair = Asymetric.genKeyPair();
    const address = Crypto.getAddressesFromPublicKey(keyPair.publicKey);
    const identity: Identity = {
      address,
      keyPair,
    };

    this.identities.push(identity);
    if (this.password && this.filename) {
      this.saveToFile(this.filename, this.password);
    }
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
