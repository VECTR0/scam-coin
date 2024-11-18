import { KeyObject } from 'crypto';
import { Asymetric, Crypto } from './util';
import { env } from './config';

export class TxIn {
  readonly txOutId: string;
  readonly txOutIndex: number;
  readonly signature: string;

  constructor(txOutId: string, txOutIndex: number, privateKey: KeyObject) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature = this.sign(privateKey);
  }

  getData(): string {
    return `${this.txOutId}-${this.txOutIndex}`;
  }

  sign(privateKey: KeyObject): string {
    return Asymetric.sign(this.getData(), privateKey);
  }

  verifySignature(publicKey: KeyObject): boolean {
    return Asymetric.verify(this.getData(), this.signature, publicKey);
  }
}

export class TxOut {
  readonly address: KeyObject; // public key
  readonly amount: number;

  constructor(address: KeyObject, amount: number) {
    this.address = address;
    this.amount = amount;
  }
}

export class Transaction {
  txIns: TxIn[];
  txOuts: TxOut[];

  constructor(txIns: TxIn[], txOuts: TxOut[]) {
    this.txIns = txIns;
    this.txOuts = txOuts;
  }

  getId(): string {
    const txInContent: string = this.txIns
      .map((txIn: TxIn) => `${txIn.txOutId}${txIn.txOutIndex}`)
      .reduce((a, b) => a + b, '');

    const txOutContent: string = this.txOuts
      .map((txOut: TxOut) => `${txOut.address}${txOut.amount}`)
      .reduce((a, b) => a + b, '');

    const plain = `${txInContent}${txOutContent}`;
    return Crypto.hash(plain);
  }

  // signTxIn(
  //   txInIndex: number,
  //   privateKey: KeyObject,
  //   unspentTxOuts: TxOut[],
  // ): string {
  //   throw Error('Not implemented');
  // }
}

export class TransPool {
  private transactions: Transaction[];

  constructor() {
    this.transactions = [];
  }

  add(transaction: Transaction): void {
    this.transactions.push(transaction);
  }

  getAll(): Transaction[] {
    return this.transactions;
  }

  get(): Transaction | null {
    // TODO: co tu ma byc
    return this.transactions.length > 0 ? this.transactions[0] : null;
  }

  removeTrans(block: Block): void {
    this.transactions = this.transactions.filter(
      (tx) => !block.transactions.includes(tx),
    );
  }
}

export class Block {
  readonly previousHash: string;
  readonly timestamp: number;
  readonly transactions: Transaction[];
  hash: string;
  nonce: number;
  difficulty: number;

  constructor(
    previousHash: string,
    transactions: Transaction[],
    difficulty: number,
  ) {
    this.previousHash = previousHash;
    this.timestamp = Date.now();
    this.transactions = transactions;
    this.difficulty = difficulty;
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  calculateHash(): string {
    const plain = `${this.previousHash}${this.timestamp}${JSON.stringify(this.transactions)}${this.nonce}${this.difficulty}`;
    return Crypto.hash(plain);
  }

  verify(): boolean {
    return this.hash === this.calculateHash();
  }

  getPOWHash(): string {
    return Array(this.difficulty + 1).join('0');
  }
}

export class Blockchain {
  private chain: Block[];
  private difficulty: number;
  private lastBlockTime: number;

  constructor(difficulty: number) {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = difficulty;
    this.lastBlockTime = Date.now();
  }

  mine(transactions: Transaction[]): Block {
    const lastBlock = this.chain[this.chain.length - 1];
    const newBlock = new Block(lastBlock.hash, transactions, this.difficulty);

    const target = newBlock.getPOWHash();

    while (newBlock.hash.substring(0, this.difficulty) !== target) {
      newBlock.nonce++;
      newBlock.hash = newBlock.calculateHash();
    }

    this.add(newBlock);
    return newBlock;
  }

  checkBalance(identity: KeyObject): number {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        for (const txOut of tx.txOuts) {
          if (txOut.address === identity) {
            balance += txOut.amount;
          }
        }
        for (const txIn of tx.txIns) {
          const referencedTxOut = this.findTxOut(txIn.txOutId, txIn.txOutIndex);
          if (referencedTxOut && referencedTxOut.address === identity) {
            balance -= referencedTxOut.amount;
          }
        }
      }
    }
    return balance;
  }

  getDifficulty(): number {
    return this.difficulty;
  }

  updateDifficulty(): void {
    const currentTime = Date.now();
    const timeTaken = currentTime - this.lastBlockTime;

    if (timeTaken < env.MIN_TIMESTAMP_DIFFERENCE_BETWEEN_BLOCKS) {
      this.difficulty++;
    } else if (
      timeTaken > env.MIN_TIMESTAMP_DIFFERENCE_BETWEEN_BLOCKS &&
      this.difficulty > 1
    ) {
      this.difficulty--;
    }
  }

  verifyBlockchain(): void {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!currentBlock.verify()) {
        throw new Error(
          `Invalid block hash at block ${i}. Expected: ${currentBlock.calculateHash()}, Found: ${currentBlock.hash}`,
        );
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        throw new Error(
          `Invalid previous hash at block ${i}. Expected: ${previousBlock.hash}, Found: ${currentBlock.previousHash}`,
        );
      }

      const target = currentBlock.getPOWHash();
      if (!currentBlock.hash.startsWith(target)) {
        throw new Error(
          `Invalid proof of work at block ${i}. Hash does not meet difficulty requirements.`,
        );
      }

      if (
        currentBlock.timestamp - env.MIN_TIMESTAMP_DIFFERENCE_BETWEEN_BLOCKS <=
        previousBlock.timestamp
      ) {
        throw new Error(
          `Invalid timestamp at block ${i}. Timestamp must be greater ${env.MIN_TIMESTAMP_DIFFERENCE_BETWEEN_BLOCKS}s than the previous block's timestamp.`,
        );
      }

      for (const tx of currentBlock.transactions) {
        this.verifyTransaction(tx);
      }
    }
  }

  private add(block: Block): void {
    const lastBlock = this.chain[this.chain.length - 1];

    if (block.previousHash !== lastBlock.hash) {
      throw new Error('Invalid block: incorrect previous hash.');
    }

    if (!block.verify()) {
      throw new Error('Invalid block: verification failed.');
    }

    this.chain.push(block);
    this.updateDifficulty();
    this.lastBlockTime = Date.now();
  }

  verifyTransaction(transaction: Transaction): void {
    let totalTxIn = 0;
    let totalTxOut = 0;

    for (const txIn of transaction.txIns) {
      const referencedTxOut = this.findTxOut(txIn.txOutId, txIn.txOutIndex);
      if (!referencedTxOut) {
        throw new Error(
          `Invalid transaction input: TxOut not found for TxIn with ID ${txIn.txOutId} at index ${txIn.txOutIndex}`,
        );
      }

      // TODO FIXME Verify signature
      if (!txIn.verifySignature(referencedTxOut.address)) {
        throw new Error(
          `Invalid signature for TxIn referencing TxOut: ${txIn.txOutId} at index ${txIn.txOutIndex}`,
        );
      }

      totalTxIn += referencedTxOut.amount;
    }

    for (const txOut of transaction.txOuts) {
      totalTxOut += txOut.amount;
    }

    if (totalTxIn !== totalTxOut) {
      throw new Error(
        `Transaction input total (${totalTxIn}) does not equal output total (${totalTxOut})`,
      );
    }
  }

  private getTransactionId(transaction: Transaction): string {
    return Crypto.hash(JSON.stringify(transaction));
  }

  private findTxOut(txOutId: string, txOutIndex: number): TxOut | null {
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (txOutId === this.getTransactionId(tx)) {
          return tx.txOuts[txOutIndex];
        }
      }
    }
    return null;
  }

  private createGenesisBlock(): Block {
    return new Block('0', [], this.difficulty);
  }
}
