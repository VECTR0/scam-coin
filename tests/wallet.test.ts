// TODO FIXME ktos popsul testy :-)
// import assert from 'node:assert';
// import { afterEach, beforeEach, describe, it } from 'node:test';
// import Wallet from '../src/wallet';
// import { existsSync, unlinkSync } from 'node:fs';

// describe('Wallet Class', () => {
//   const wallet = Wallet.getInstance();
//   const testFilename = 'test-wallet.dat';
//   const testPassword = 'my-secure-password';
//   const address = 'localhost:4000';

//   beforeEach(() => {
//     // Reset Wallet Singleton
//     wallet.reset();
//   });

//   afterEach(() => {
//     // Clean up the test file after each test
//     if (existsSync(testFilename)) {
//       unlinkSync(testFilename);
//     }
//   });

//   it('should create a new wallet', () => {
//     wallet.create(testPassword);
//     assert.ok(wallet.uuid); // Check if uuid is set
//     assert.strictEqual(wallet.getIdentities().length, 0); // Check that there are no identities yet
//   });

//   it('should create an identity and save to file', () => {
//     wallet.create(testPassword);
//     wallet.createIdentity(testFilename, address);

//     assert.strictEqual(wallet.getIdentities().length, 1); // Check that an identity was created
//     assert.ok(existsSync(wallet.getPath(testFilename))); // Check if file exists
//   });

//   it('should create 2 identities and save to file', () => {
//     wallet.create(testPassword);

//     wallet.createIdentity(testFilename, address);
//     wallet.createIdentity(testFilename, `${address}v2`);

//     assert.strictEqual(wallet.getIdentities().length, 2); // Check that an identity was created
//     assert.ok(existsSync(wallet.getPath(testFilename))); // Check if file exists
//   });

//   it('should load a wallet from file', () => {
//     wallet.create(testPassword);
//     const { uuid } = wallet;
//     const identitiesLen = wallet.getIdentities().length;

//     wallet.createIdentity(testFilename, address);
//     wallet.loadFromFile(testFilename, testPassword);

//     assert.strictEqual(uuid, wallet.uuid); // Check if uuid matches
//     assert.strictEqual(wallet.getIdentities().length, 1); // Check if identities were loaded
//     assert.strictEqual(identitiesLen, 0); // Check if there were no identities before loading
//   });

//   it('should throw an error if trying to load with incorrect password', () => {
//     wallet.create(testPassword);
//     wallet.createIdentity(testFilename, address);

//     assert.throws(
//       () => {
//         wallet.loadFromFile(testFilename, `${testPassword}-wrong-password`);
//       },
//       { message: 'Failed to load wallet.' },
//     );
//   });

//   it('should throw an error if trying to create identity without a password', () => {
//     assert.throws(
//       () => {
//         wallet.createIdentity(testFilename, address);
//       },
//       {
//         message: 'No wallet is loaded. Please create or load a wallet first.',
//       },
//     );
//   });
// });
