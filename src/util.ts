import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  KeyObject,
} from 'crypto';
import { env } from './config';
import bs58 from 'bs58';

const encryptionIV = createHash('sha512')
  .update(env.SECRET_IV)
  .digest('hex')
  .substring(0, 16);
const AES_ENCRYPTION_METHOD = 'aes-256-cbc';

export type KeyPair = {
  privateKey: KeyObject;
  publicKey: KeyObject;
};

export class Asymetric {
  // Asymetric: https://asecuritysite.com/node/node_signec

  static genKeyPair() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'sect233k1',
    });
    return { privateKey, publicKey };
  }

  static sign(data: string, privateKey: KeyObject): string {
    const signer = createSign('SHA256');
    signer.update(data);
    return signer.sign(privateKey, 'hex');
  }

  static verify(
    data: string,
    signature: string,
    publicKey: KeyObject,
  ): boolean {
    const verifier = createVerify('SHA256');
    verifier.update(data);
    return verifier.verify(publicKey, signature, 'hex');
  }
}

export class AES {
  // Symetric: https://dev.to/jobizil/encrypt-and-decrypt-data-in-nodejs-using-aes-256-cbc-2l6d

  static encrypt(data: string, password: string): string {
    const key = this.hashAESKey(password);
    const cipher = createCipheriv(AES_ENCRYPTION_METHOD, key, encryptionIV);
    return Buffer.from(
      cipher.update(data, 'utf8', 'hex') + cipher.final('hex'),
    ).toString('base64');
  }

  static decrypt(cipher: string, password: string): string {
    const key = this.hashAESKey(password);
    const buff = Buffer.from(cipher, 'base64');
    const decipher = createDecipheriv(AES_ENCRYPTION_METHOD, key, encryptionIV);
    return (
      decipher.update(buff.toString('utf8'), 'hex', 'utf8') +
      decipher.final('utf8')
    );
  }

  private static hashAESKey(password: string): string {
    return createHash('sha512').update(password).digest('hex').substring(0, 32);
  }
}

export class Crypto {
  static hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  static getAddressesFromPublicKey(publicKey: KeyObject): string {
    const publicKeyStringify = publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
    const base64 = publicKeyStringify
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');

    const publicKeyBytes = Buffer.from(base64, 'base64');
    const hash = createHash('sha256').update(publicKeyBytes).digest();
    const prefix = Buffer.from([0x42]);
    const extended = Buffer.concat([prefix, Buffer.from(hash)]);
    const checksum = createHash('sha256')
      .update(extended)
      .digest()
      .subarray(0, 4);
    const buffer = Buffer.concat([extended, checksum]);
    const address = bs58.encode(buffer);
    return address;
  }
}
