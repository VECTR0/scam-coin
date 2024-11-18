import { createPublicKey, KeyObject } from 'crypto';
import { Asymetric, Crypto } from './util';
import { env } from './config';

export class TxIn {
  readonly txOutId: string;
  readonly txOutIndex: number;
  readonly signature: string;

  constructor(
    txOutId: string,
    txOutIndex: number,
    privateKey: KeyObject | string,
  ) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature =
      privateKey instanceof KeyObject ? this.sign(privateKey) : privateKey;
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

  static serialize(txIn: TxIn): string {
    return JSON.stringify(txIn);
  }

  static deserialize(json: string): TxIn {
    const data = JSON.parse(json);
    return new TxIn(data.txOutId, data.txOutIndex, data.signature);
  }
}

export class TxOut {
  readonly address: KeyObject; // public key
  readonly amount: number;

  constructor(address: KeyObject, amount: number) {
    this.address = address;
    this.amount = amount;
  }

  static serialize(txOut: TxOut): string {
    const address = txOut.address.export({
      type: 'spki',
      format: 'pem',
    }) as string;
    return JSON.stringify({
      address,
      amount: txOut.amount,
    });
  }

  static deserialize(json: string): TxOut {
    const data = JSON.parse(json);
    const address = createPublicKey({ key: data.address, format: 'pem' });
    return new TxOut(address, data.amount);
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

  static serialize(transaction: Transaction): string {
    return JSON.stringify({
      txIns: transaction.txIns.map((x) => JSON.parse(TxIn.serialize(x))),
      txOuts: transaction.txOuts.map((x) => JSON.parse(TxOut.serialize(x))),
    });
  }

  static deserialize(json: string): Transaction {
    const data = JSON.parse(json);
    const txIns: TxIn[] = data.txIns.map((txInJson: string) =>
      TxIn.deserialize(JSON.stringify(txInJson)),
    );
    const txOuts: TxOut[] = data.txOuts.map((txOutJson: string) =>
      TxOut.deserialize(JSON.stringify(txOutJson)),
    );
    return new Transaction(txIns, txOuts);
  }
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
    return this.transactions.length > 0 ? this.transactions[0] : null;
  }

  removeTrans(block: Block): void {
    this.transactions = this.transactions.filter(
      (tx) => !block.transactions.includes(tx),
    );
  }

  hasTrans(trans: Transaction): boolean {
    return this.transactions.some((t) => t.getId() === trans.getId());
  }
}

export class Block {
  readonly previousHash: string;
  readonly transactions: Transaction[];
  timestamp: number;
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

  static serialize(block: Block): string {
    return JSON.stringify({
      previousHash: block.previousHash,
      timestamp: block.timestamp,
      transactions: block.transactions.map((tx) => Transaction.serialize(tx)),
      difficulty: block.difficulty,
      hash: block.hash,
      nonce: block.nonce,
    });
  }

  static deserialize(json: string): Block {
    const data = JSON.parse(json);

    const transactions = data.transactions.map((txJson: string) =>
      Transaction.deserialize(txJson),
    );

    const block = new Block(data.previousHash, transactions, data.difficulty);
    block.hash = data.hash;
    block.nonce = data.nonce;
    block.timestamp = data.timestamp;
    return block;
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

  public getAll(): Block[] {
    return this.chain;
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

  hasBlock(block: Block): boolean {
    return this.chain.some((b) => b.hash === block.hash);
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

  public add(block: Block): void {
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
    // return new Block('0', [], this.difficulty);
    const serialized = '{"previousHash":"0","timestamp":1731965982450,"transactions":[],"hash":"d5303571b790f83168851382ca17fc67f00aea5b9e66aec99639fd1f32982344","nonce":0}';
    return Block.deserialize(serialized);
  }
}
