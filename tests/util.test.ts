import assert from 'node:assert';
import { describe, it } from 'node:test';
import { AES, Asymetric } from '../src/util';

describe('AES Encryption/Decryption', () => {
  const data = 'hello world';
  const password = 'pass';

  it('should encrypt and decrypt the data correctly', () => {
    const cipher = AES.encrypt(data, password);
    const plain = AES.decrypt(cipher, password);
    assert.strictEqual(plain, data);
  });

  it('should return different cipher text when encrypting different data with the same password', () => {
    const data1 = 'hello world';
    const data2 = 'goodbye world';

    const cipher1 = AES.encrypt(data1, password);
    const cipher2 = AES.encrypt(data2, password);

    assert.notStrictEqual(cipher1, cipher2);
  });

  it('should throw an ERR_OSSL_BAD_DECRYPT error when trying to decrypt with a wrong password', () => {
    const cipher = AES.encrypt(data, password);
    const wrongPassword = 'wrongpass';

    assert.throws(
      () => {
        AES.decrypt(cipher, wrongPassword);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => {
        return err.code === 'ERR_OSSL_BAD_DECRYPT';
      },
      'Expected decryption to throw ERR_OSSL_BAD_DECRYPT',
    );
  });

  it('should handle empty data input correctly', () => {
    const cipher = AES.encrypt('', password);
    const plain = AES.decrypt(cipher, password);
    assert.strictEqual(plain, '');
  });

  it('should handle empty password input correctly', () => {
    const cipher = AES.encrypt(data, '');
    const plain = AES.decrypt(cipher, '');
    assert.strictEqual(plain, data);
  });

  it('should consistently encrypt the same data with the same password', () => {
    const cipher1 = AES.encrypt(data, password);
    const cipher2 = AES.encrypt(data, password);
    assert.strictEqual(cipher1, cipher2);
  });

  it('should encrypt to a different cipher text when using a different password', () => {
    const cipher1 = AES.encrypt(data, password);
    const cipher2 = AES.encrypt(data, 'differentpass');
    assert.notStrictEqual(cipher1, cipher2);
  });
});

describe('Asymetric', () => {
  const testData = 'Hello, World!';
  const { privateKey, publicKey } = Asymetric.genKeyPair();
  // const privateKey = 'ddddd';
  // const publicKey = 'eeeeeefwefkpwe';

  it('should sign data and verify the signature', () => {
    const signature = Asymetric.sign(testData, privateKey);
    const isVerified = Asymetric.verify(testData, signature, publicKey);

    assert.equal(isVerified, true);
  });

  it('should fail verification for tampered data', () => {
    const signature = Asymetric.sign(testData, privateKey);
    const tamperedData = 'Goodbye, World!';
    const isVerified = Asymetric.verify(tamperedData, signature, publicKey);

    assert.equal(isVerified, false);
  });

  it('should fail verification for invalid signature', () => {
    const invalidSignature = 'invalid_signature';
    const isVerified = Asymetric.verify(testData, invalidSignature, publicKey);

    assert.equal(isVerified, false);
  });
});
