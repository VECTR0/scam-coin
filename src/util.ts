import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
} from 'crypto';
import { env } from './config';

const encryptionIV = createHash('sha512')
  .update(env.SECRET_IV)
  .digest('hex')
  .substring(0, 16);
const AES_ENCRYPTION_METHOD = 'aes-256-cbc';

export type KeyPair = {
  privateKey: string;
  publicKey: string;
};

class Crypto {
  /*
    Asymetric: https://asecuritysite.com/node/node_signec
    Symetric: https://dev.to/jobizil/encrypt-and-decrypt-data-in-nodejs-using-aes-256-cbc-2l6d
  */
  static hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  static keyPair(): KeyPair {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return {
      privateKey: `${privateKey}`,
      publicKey: `${publicKey}`,
    } as KeyPair;
  }

  static encryptAES(data: string, password: string): string {
    const key = this.hashAESKey(password);
    const cipher = createCipheriv(AES_ENCRYPTION_METHOD, key, encryptionIV);
    return Buffer.from(
      cipher.update(data, 'utf8', 'hex') + cipher.final('hex'),
    ).toString('base64');
  }

  static decryptAES(cipher: string, password: string): string {
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

export { Crypto };
