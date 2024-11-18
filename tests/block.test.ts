import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  Blockchain,
  Transaction,
  TxIn,
  TxOut,
  TransPool,
  Block,
} from '../src/block';
import { Asymetric } from '../src/util';
import { KeyObject } from 'node:crypto';

// const { privateKey: privateKey2, publicKey: publicKey2 } =
//   Asymetric.genKeyPair();

describe('Blockchain Tests', () => {
  let blockchain: Blockchain;
  let transPool: TransPool;
  let privateKey: KeyObject;
  let publicKey: KeyObject;

  beforeEach(() => {
    blockchain = new Blockchain(2);
    transPool = new TransPool();
    const { privateKey: sc, publicKey: pk } = Asymetric.genKeyPair();
    privateKey = sc;
    publicKey = pk;
  });

  it('should create a genesis block', () => {
    const genesisBlock = blockchain['chain'][0];
    assert.equal(genesisBlock.previousHash, '0');
    assert.deepEqual(genesisBlock.transactions, []);
  });

  //
  // it('should create and verify a transaction', () => {
  //   const txOut = new TxOut(publicKey, 50);
  //   const txIn = new TxIn('dummyTxOutId', 0, privateKey);
  //   const transaction = new Transaction([txIn], [txOut]);

  //   transPool.add(transaction);
  //   console.log('trans:\n', transPool);
  //   console.log('txin:\n', transaction.getId());
  //   console.log('trans:\n', blockchain.verifyTransaction(transaction));
  //   assert.equal(transPool.getAll().length, 1);

  //   assert.doesNotThrow(() => blockchain['verifyTransaction'](transaction));
  // });

  it('should mine a valid block and add it to the chain', () => {
    const initialLength = blockchain['chain'].length;

    const txIn = new TxIn('previousTxId', 0, privateKey);
    const txOut1 = new TxOut(publicKey, 100);
    const txOut2 = new TxOut(publicKey, 50);
    const transaction = new Transaction([txIn], [txOut1, txOut2]);

    const minedBlock = blockchain.mine([transaction]);

    // Validate chain length.
    assert.strictEqual(blockchain['chain'].length, initialLength + 1);

    // Validate that the new block has the correct previous hash.
    assert.strictEqual(
      minedBlock.previousHash,
      blockchain['chain'][initialLength - 1].hash,
    );

    const diff = minedBlock.difficulty;
    assert.strictEqual(minedBlock.hash.substring(0, diff), '0'.repeat(diff));

    // Validate transactions are correctly included.
    assert.deepStrictEqual(minedBlock.transactions, [transaction]);
  });

  it('should mine a block with transactions', () => {
    const txOut = new TxOut(publicKey, 50);
    const txIn = new TxIn('dummyTxOutId', 0, privateKey);
    const transaction = new Transaction([txIn], [txOut]);

    transPool.add(transaction);
    const minedBlock = blockchain.mine(transPool.getAll());

    assert.equal(minedBlock.transactions.length, 1);
    assert.equal(minedBlock.transactions[0].txOuts[0].address, publicKey);
  });

  //   it('should verify blockchain integrity', () => {
  //     const txOut = new TxOut(publicKey, 50);
  //     const txIn = new TxIn('dummyTxOutId', 0, privateKey);
  //     const transaction = new Transaction([txIn], [txOut]);

  //     transPool.add(transaction);
  //     blockchain.mine(transPool.getAll());

  //     assert.doesNotThrow(() => blockchain.verifyBlockchain());
  //   });

  it('should throw error for invalid transactions', () => {
    const invalidTxIn = new TxIn('invalidTxOutId', 0, privateKey);
    const txOut = new TxOut(publicKey, 50);
    const transaction = new Transaction([invalidTxIn], [txOut]);

    assert.throws(() => blockchain['verifyTransaction'](transaction), {
      message: /Invalid transaction input: TxOut not found/,
    });
  });

  //   it('should check the balance of an address', () => {
  //     const txOut1 = new TxOut(publicKey, 50);
  //     const txIn1 = new TxIn('dummyTxOutId', 0, privateKey);
  //     const transaction1 = new Transaction([txIn1], [txOut1]);

  //     const txOut2 = new TxOut(publicKey, 30);
  //     const txIn2 = new TxIn('dummyTxOutId', 0, privateKey);
  //     const transaction2 = new Transaction([txIn2], [txOut2]);

  //     transPool.add(transaction1);
  //     blockchain.mine(transPool.getAll());

  //     transPool.add(transaction2);
  //     blockchain.mine(transPool.getAll());

  //     const balance = blockchain.checkBalance(publicKey);
  //     assert.equal(balance, 80); // 50 + 30
  //   });

  //   it('should update difficulty based on block timing', () => {
  //     setTimeout(() => {
  //       const txOut = new TxOut(publicKey, 50);
  //       const txIn = new TxIn('dummyTxOutId', 0, privateKey);
  //       const transaction = new Transaction([txIn], [txOut]);

  //       transPool.add(transaction);
  //       blockchain.mine(transPool.getAll());

  //       assert.equal(blockchain.getDifficulty(), 4);

  //       for (let i = 0; i < 5; i++) {
  //         blockchain.mine(transPool.getAll());
  //       }

  //       assert.equal(blockchain.getDifficulty(), 3);
  //     }, 1500);
  //   });

  describe('Transaction Serialization and Deserialization', () => {
    it('should correctly serialize and deserialize a TxIn', () => {
      const txIn = new TxIn('prevTxId', 0, privateKey);
      const serialized = TxIn.serialize(txIn);
      const deserialized = TxIn.deserialize(serialized);

      assert.strictEqual(deserialized.txOutId, txIn.txOutId);
      assert.strictEqual(deserialized.txOutIndex, txIn.txOutIndex);
      assert.strictEqual(deserialized.signature, txIn.signature);
    });

    it('should correctly serialize and deserialize a TxOut', () => {
      const txOut = new TxOut(publicKey, 100);
      const serialized = TxOut.serialize(txOut);
      const deserialized = TxOut.deserialize(serialized);

      assert.strictEqual(deserialized.amount, txOut.amount);
      assert.strictEqual(
        deserialized.address.export({ type: 'spki', format: 'pem' }),
        publicKey.export({ type: 'spki', format: 'pem' }),
      );
    });

    it('should correctly serialize and deserialize a Transaction', () => {
      const txIn = new TxIn('prevTxId', 0, privateKey);
      const txOut = new TxOut(publicKey, 100);
      const transaction = new Transaction([txIn], [txOut]);

      const serialized = Transaction.serialize(transaction);
      const deserialized = Transaction.deserialize(serialized);

      assert.strictEqual(deserialized.txIns.length, 1);
      assert.strictEqual(deserialized.txOuts.length, 1);
      assert.strictEqual(deserialized.txIns[0].txOutId, txIn.txOutId);
      assert.strictEqual(deserialized.txOuts[0].amount, txOut.amount);
      assert.strictEqual(
        deserialized.txOuts[0].address.export({ type: 'spki', format: 'pem' }),
        publicKey.export({ type: 'spki', format: 'pem' }),
      );
    });
  });

  describe('Block Serialization and Deserialization with Transactions', () => {
    it('should correctly serialize and deserialize a Block with Transactions', () => {
      const txIn = new TxIn('prevTxId', 0, privateKey);
      const txOut = new TxOut(publicKey, 100);
      const transaction = new Transaction([txIn], [txOut]);

      const block = new Block('0', [transaction], 3);
      const serialized = Block.serialize(block);
      const deserializedBlock = Block.deserialize(serialized);

      assert.strictEqual(deserializedBlock.previousHash, block.previousHash);
      assert.strictEqual(deserializedBlock.difficulty, block.difficulty);
      assert.strictEqual(deserializedBlock.transactions.length, 1);
      assert.strictEqual(
        deserializedBlock.transactions[0].txIns[0].txOutId,
        transaction.txIns[0].txOutId,
      );
      assert.strictEqual(
        deserializedBlock.transactions[0].txOuts[0].amount,
        100,
      );
    });
  });
});
