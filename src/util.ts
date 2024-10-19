import { createHash, generateKeyPairSync } from 'crypto';

class Crypto {
  static hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }
  static keyPair(): string {
    // TODO: https://asecuritysite.com/node/node_signec
    // 'ed25519' | 'ec
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
      namedCurve: 'secp256k1',
      //   namedCurve: 'secp256r1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return `${privateKey}_${publicKey}`;
  }
  static aes(): string {
    // CBC;
    return '';
  }
}

export { Crypto };
