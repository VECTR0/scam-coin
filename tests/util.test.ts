import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Crypto } from '../src/util';

describe('AES Encryption/Decryption', () => {
  const data = 'hello world';
  const password = 'pass';

  it('should encrypt and decrypt the data correctly', () => {
    const cipher = Crypto.encryptAES(data, password);
    const plain = Crypto.decryptAES(cipher, password);
    assert.strictEqual(plain, data);
  });

  it('should return different cipher text when encrypting different data with the same password', () => {
    const data1 = 'hello world';
    const data2 = 'goodbye world';

    const cipher1 = Crypto.encryptAES(data1, password);
    const cipher2 = Crypto.encryptAES(data2, password);

    assert.notStrictEqual(cipher1, cipher2);
  });

  it('should throw an ERR_OSSL_BAD_DECRYPT error when trying to decrypt with a wrong password', () => {
    const cipher = Crypto.encryptAES(data, password);
    const wrongPassword = 'wrongpass';

    assert.throws(
      () => {
        Crypto.decryptAES(cipher, wrongPassword);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => {
        return err.code === 'ERR_OSSL_BAD_DECRYPT';
      },
      'Expected decryption to throw ERR_OSSL_BAD_DECRYPT',
    );
  });

  it('should handle empty data input correctly', () => {
    const cipher = Crypto.encryptAES('', password);
    const plain = Crypto.decryptAES(cipher, password);
    assert.strictEqual(plain, '');
  });

  it('should handle empty password input correctly', () => {
    const cipher = Crypto.encryptAES(data, '');
    const plain = Crypto.decryptAES(cipher, '');
    assert.strictEqual(plain, data);
  });

  it('should consistently encrypt the same data with the same password', () => {
    const cipher1 = Crypto.encryptAES(data, password);
    const cipher2 = Crypto.encryptAES(data, password);
    assert.strictEqual(cipher1, cipher2);
  });

  it('should encrypt to a different cipher text when using a different password', () => {
    const cipher1 = Crypto.encryptAES(data, password);
    const cipher2 = Crypto.encryptAES(data, 'differentpass');
    assert.notStrictEqual(cipher1, cipher2);
  });
});
