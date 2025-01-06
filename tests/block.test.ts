import { describe, it } from 'node:test';

import assert from 'assert';
import { Block, Blockchain, OrphanBlocks } from '../src/block';

// Test Block class
describe('Block Class', () => {
  it('should calculate hash correctly', () => {
    const block = new Block('0', [], 1);
    const expectedHash = block.calculateHash();
    assert.strictEqual(
      block.hash,
      expectedHash,
      'Hash does not match calculated hash',
    );
  });

  it('should serialize and deserialize correctly', () => {
    const block = new Block('0', [], 1);
    const serialized = Block.serialize(block);
    const deserialized = Block.deserialize(serialized);
    assert.strictEqual(
      deserialized.previousHash,
      block.previousHash,
      'Deserialized previousHash does not match',
    );
    assert.deepStrictEqual(
      deserialized.transactions,
      block.transactions,
      'Deserialized transactions do not match',
    );
    assert.strictEqual(
      deserialized.difficulty,
      block.difficulty,
      'Deserialized difficulty does not match',
    );
  });

  it('should verify the block hash', () => {
    const block = new Block('0', [], 1);
    assert.strictEqual(block.verify(), true, 'Block verification failed');
  });

  it('should fail verification if hash is tampered', () => {
    const block = new Block('0', [], 1);
    block.hash = 'tampered_hash';
    assert.strictEqual(
      block.verify(),
      false,
      'Tampered block should fail verification',
    );
  });
});

// Test OrphanBlocks class
describe('OrphanBlocks Class', () => {
  it('should add orphan blocks correctly', () => {
    const orphanBlocks = new OrphanBlocks(60000);
    const block = new Block('1', [], 1);
    orphanBlocks.add(block);
    const retrievedBlock = orphanBlocks.getBlock([], block.hash);
    assert.strictEqual(
      retrievedBlock,
      block,
      'Orphan block not added correctly',
    );
  });

  it('should calculate the possible blockchain length correctly', () => {
    const orphanBlocks = new OrphanBlocks(60000);
    const genesisBlock = new Block('0', [], 1);
    const block = new Block(genesisBlock.hash, [], 1);
    orphanBlocks.add(block);
    const length = orphanBlocks.getPossibleBlockChainLength(
      [genesisBlock],
      block,
    );
    assert.strictEqual(length, 2, 'Possible blockchain length is incorrect');
  });

  it('should cleanup expired blocks', () => {
    const orphanBlocks = new OrphanBlocks(1); // 1 ms TTL
    const block = new Block('1', [], 1);
    orphanBlocks.add(block);

    setTimeout(() => {
      orphanBlocks.cleanup();
      const retrievedBlock = orphanBlocks.getBlock([], block.hash);
      assert.strictEqual(
        retrievedBlock,
        undefined,
        'Expired block not cleaned up',
      );
    }, 10);
  });
});

// Test Blockchain class
describe('Blockchain Class', () => {
  const dummyDiff = 1;
  const dummyTx = [];

  it('should initialize with a genesis block', () => {
    const blockchain = new Blockchain(1, 50);
    const genesisBlock = blockchain.getAll()[0];
    assert.strictEqual(
      genesisBlock.previousHash,
      '0',
      'Genesis block has incorrect previous hash',
    );
  });

  it('should mine a new block', () => {
    const blockchain = new Blockchain(1, 50);
    const newBlock = blockchain.mine([]);
    assert.strictEqual(
      blockchain.getLatestBlock(),
      newBlock,
      'Mined block is not the latest block',
    );
  });

  it('should verify the blockchain', () => {
    const blockchain = new Blockchain(1, 50);
    blockchain.mine([]);
    assert.doesNotThrow(
      () => blockchain.verifyBlockchain(),
      'Blockchain verification failed',
    );
  });

  it('should reject invalid blocks', () => {
    const blockchain = new Blockchain(1, 50);
    const block = blockchain.getLatestBlock();
    block.hash = 'tampered_hash';
    assert.throws(
      () => blockchain.add(block),
      /Invalid block/,
      'Tampered block should not be accepted',
    );
  });

  it('should calculate balance correctly', () => {
    const blockchain = new Blockchain(1, 50);
    const address = 'test_address';
    blockchain.createCoinbaseTransaction(address);
    const balance = blockchain.getBalance(address);
    assert(balance.balance >= 0, 'Balance calculation is incorrect');
  });

  it('should add orphan block', () => {
    const blockchain = new Blockchain(2, 50);
    const chain = blockchain.getChain();
    const genesisBlock = chain[0] as Block;
    const firstBlock = new Block(genesisBlock.hash, dummyTx, dummyDiff);
    const secondBlock = new Block(firstBlock.hash, dummyTx, dummyDiff);
    const thirdBlock = new Block(secondBlock.hash, dummyTx, dummyDiff);
    const fourthBlock = new Block(thirdBlock.hash, dummyTx, dummyDiff);

    blockchain.add(firstBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 0);

    blockchain.add(thirdBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 1);

    blockchain.add(fourthBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 2);

    blockchain.add(secondBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 0);

    assert.strictEqual(blockchain.getSize(), 5);

    assert.strictEqual(chain[0].hash, genesisBlock.hash);
    assert.strictEqual(chain[1].hash, firstBlock.hash);
    assert.strictEqual(chain[2].hash, secondBlock.hash);
    assert.strictEqual(chain[3].hash, thirdBlock.hash);
    assert.strictEqual(chain[4].hash, fourthBlock.hash);
  });

  it('should handle fork properly', () => {
    const blockchain = new Blockchain(2, 50);
    const chain = blockchain.getChain();
    const genesisBlock = chain[0] as Block;

    const firstBlock = new Block(genesisBlock.hash, dummyTx, dummyDiff);
    const secondBlock = new Block(firstBlock.hash, dummyTx, dummyDiff);
    const thirdBlock = new Block(secondBlock.hash, dummyTx, dummyDiff);
    for (let i = 0; i < 1e6; i++) {
      // force differet hash (by modifying timestamp)
      i++;
      i--;
    }
    const ABlock = new Block(secondBlock.hash, dummyTx, dummyDiff);
    const BBlock = new Block(ABlock.hash, dummyTx, dummyDiff);

    blockchain.add(firstBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 0);

    blockchain.add(secondBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 0);

    blockchain.add(thirdBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 0);

    blockchain.add(ABlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 1);

    const secondOrphan1 = blockchain
      .getOrphanBlocks()
      .getMap()
      .get(secondBlock.hash);

    assert.ok(secondOrphan1 !== undefined);
    assert.equal(secondOrphan1[0].hash, ABlock.hash);

    blockchain.add(BBlock);
    assert.strictEqual(blockchain.getOrphanBlocks().getMap().size, 1);

    const secondOrphan2 = blockchain
      .getOrphanBlocks()
      .getMap()
      .get(secondBlock.hash);

    assert.ok(secondOrphan2 !== undefined);
    assert.equal(secondOrphan2[0].hash, thirdBlock.hash);

    assert.strictEqual(chain[0].hash, genesisBlock.hash);
    assert.strictEqual(chain[1].hash, firstBlock.hash);
    assert.strictEqual(chain[2].hash, secondBlock.hash);
    // assert.strictEqual(chain[3].hash, thirdBlock.hash);
    assert.strictEqual(chain[3].hash, ABlock.hash);
    assert.strictEqual(chain[4].hash, BBlock.hash);
  });
});
