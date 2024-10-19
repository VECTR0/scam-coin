import { Crypto } from './util';

class Block {
  readonly index: number; // or uuid
  readonly previousHash: string;
  readonly timestamp: number;
  readonly data: string;
  readonly difficulty: number;
  readonly nonce: number;

  constructor(
    index: number,
    previousHash: string,
    timestamp: number,
    data: string,
    difficulty: number,
    nonce: number,
  ) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }

  calculateHash(): string {
    const plain = `${this.index}${this.previousHash}${this.timestamp}${this.data}`;
    return Crypto.hash(plain);
    /*
      consequence of the properties hash and previousHash is that a block can’t
      be modified without changing the hash of every consecutive block.
      */
  }

  generateNextBlock(blockData: string): Block {
    const previousBlock: Block = this.getLatestBlock();
    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = Date.now();
    const newBlock = new Block(
      nextIndex,
      previousBlock.calculateHash(),
      nextTimestamp,
      blockData,
      69, //FIXME
      69, //FIXME
    );
    return newBlock;
  }

  getLatestBlock(): Block {
    // TODO:
    const block = new Block(3, 'prevhash', Date.now(), 'dejta', 6, 6);
    return block;
  }

  findBlock = (
    index: number,
    previousHash: string,
    timestamp: number,
    data: string,
    difficulty: number,
  ): Block => {
    let nonce = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const hash = new Block(
        index,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce,
      ).calculateHash();

      //   if (hashMatchesDifficulty(hash, difficulty)) {
      //     return new Block(
      //       index,
      //       hash,
      //       previousHash,
      //       timestamp,
      //       data,
      //       difficulty,
      //       nonce,
      //     );
      //   }
      nonce++;
    }
  };
}
class TxIn {
  txOutId: string;
  txOutIndex: number;
  signature: string;

  constructor(txOutId: string, txOutIndex: number, signature: string) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature = signature;
  }
}
class TxOut {
  address: string;
  amount: number;

  constructor(address: string, amount: number) {
    this.address = address;
    this.amount = amount;
  }
}
type Tx = { in: TxIn; out: TxOut };
class Transaction {
  id: string;
  txs: Tx[];

  constructor(id: string, txs: Tx[]) {
    this.id = id;
    this.txs = txs;
  }

  getId(): string {
    const txInContent: string = this.txs
      .map((tx) => tx.in.txOutId + tx.in.txOutIndex)
      .reduce((a, b) => a + b, '');

    const txOutContent: string = this.txs
      .map((tx) => tx.out.address + tx.out.amount)
      .reduce((a, b) => a + b, '');

    const plain = `${txInContent}${txOutContent}`;
    const hash = Crypto.hash(plain);
    return hash;
  }
}
export default Block;
