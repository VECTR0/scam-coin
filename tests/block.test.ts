import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { Blockchain, Transaction, TxIn, TxOut, TransPool } from '../src/block';
import { Asymetric } from '../src/util';

const { privateKey, publicKey } = Asymetric.genKeyPair();

describe('Blockchain Tests', () => {
  let blockchain: Blockchain;
  let transPool: TransPool;

  beforeEach(() => {
    blockchain = new Blockchain(1000);
    transPool = new TransPool();
  });

  it('should create a genesis block', () => {
    const genesisBlock = blockchain['chain'][0];
    assert.equal(genesisBlock.previousHash, '0');
    assert.deepEqual(genesisBlock.transactions, []);
  });

  // it('should create and verify a transaction', () => {
  //   const txOut = new TxOut(publicKey, 50);
  //   const txIn = new TxIn('dummyTxOutId', 0, privateKey);
  //   const transaction = new Transaction([txIn], [txOut]);

  //   transPool.add(transaction);
  //   assert.equal(transPool.getAll().length, 1);

  //   assert.doesNotThrow(() => blockchain['verifyTransaction'](transaction));
  // });

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
});
