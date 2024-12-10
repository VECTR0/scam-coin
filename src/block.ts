import { createPublicKey, KeyObject } from 'crypto';
import { Asymetric, Crypto } from './util';
import { env } from './config';

type PublicKeyHash = string;

class UTXO {
  txOutId: string;
  txOutIndex: number;
  amount: number;

  constructor(txOutId: string, txOutIndex: number, amount: number) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.amount = amount;
  }

  stringify(): string {
    const json = JSON.stringify(this)
    return json
  }
}

type UnspentResult = {
  balance: number,
  utxos: UTXO[]
}

export class TxIn {
  readonly txOutId: string;
  readonly txOutIndex: number;
  readonly publicKey: KeyObject;
  signature: string | null;

  constructor(
    txOutId: string,
    txOutIndex: number,
    publicKey: KeyObject,
    signature: string | null,
  ) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.publicKey = publicKey
    this.signature = signature
  }

  getData(): string {
    return `${this.txOutId}-${this.txOutIndex}`;
  }

  sign(privateKey: KeyObject) {
    this.signature = Asymetric.sign(this.getData(), privateKey);
  }

  verifySignature(): boolean {
    if (!this.signature) {
      return false;
    }
    return Asymetric.verify(this.getData(), this.signature, this.publicKey);
  }

  static serialize(txIn: TxIn): string {
    const publicKey = Crypto.KeyObjectToString(txIn.publicKey, true)
    const jsonizable = {
      txOutId: txIn.txOutId,
      txOutIndex: txIn.txOutIndex,
      publicKey: publicKey,
      signature: txIn.signature
    }
    const json = JSON.stringify(jsonizable)
    return json;
  }

  static deserialize(json: string): TxIn {
    const data = JSON.parse(json);
    const publicKey = Crypto.StringToKeyObject(data.publicKey, true)
    return new TxIn(data.txOutId, data.txOutIndex, publicKey, data.signature);
  }
}

export class TxOut {
  readonly address: PublicKeyHash;
  readonly amount: number;

  constructor(address: PublicKeyHash, amount: number) {
    this.address = address;
    this.amount = amount;
  }

  static serialize(txOut: TxOut): string {
    return JSON.stringify({
      address: txOut.address,
      amount: txOut.amount,
    });
  }

  static deserialize(json: string): TxOut {
    const data = JSON.parse(json);
    return new TxOut(data.address, data.amount);
  }
}

export class Transaction {
  public id: string;
  public txIns: TxIn[];
  public txOuts: TxOut[];

  constructor(txIns: TxIn[], txOuts: TxOut[]) {
    this.txIns = txIns;
    this.txOuts = txOuts;
    this.id = this.getId()
  }

  getId(): string {
    const txInContent: string = this.txIns
      .map((txIn: TxIn) => `${txIn.txOutId}.${txIn.txOutIndex}.${txIn.signature},`)
      .reduce((a, b) => a + b, '');

    const txOutContent: string = this.txOuts
      .map((txOut: TxOut) => `${txOut.address}.${txOut.amount},`)
      .reduce((a, b) => a + b, '');

    const plain = `${txInContent}_${txOutContent}`;
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

  addReward(address: string, reward: number): void {
    const txOut = new TxOut(address, reward);
    this.txOuts.push(txOut);
    this.id = this.getId();
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

  drop(): void {
    this.transactions.shift();
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
  miningReward: number;

  constructor(difficulty: number, miningReward: number) {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = difficulty;
    this.lastBlockTime = Date.now();
    this.miningReward = miningReward;
  }

  public getAll(): Block[] {
    return this.chain;
  }

  mine(transactions: Transaction[]): Block {
    for (const tx of transactions) {
      this.verifyTransaction(tx);
    }

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

  getBalance(address: PublicKeyHash): UnspentResult {
    const txIdMap = new Map<string, Transaction>();
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        txIdMap.set(tx.getId(), tx);
      }
    }

    const utxosSet = new Set<string>();

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        for (const txOut of tx.txOuts) {
          if (txOut.address === address) {
            const unspentTxOut = new UTXO(tx.getId(), tx.txOuts.indexOf(txOut), txOut.amount);
            utxosSet.add(unspentTxOut.stringify());
          }
        }
        for (const txIn of tx.txIns) {
          if (txIn.txOutId === '0' && txIn.txOutIndex === -1) {
            continue;
          }
          const referencedTx = txIdMap.get(txIn.txOutId);
          if (!referencedTx) {
            throw new Error(`Referenced transaction not found: ${txIn.txOutId}`);
          }
          const referencedTxOut = referencedTx.txOuts[txIn.txOutIndex];
          if (!referencedTxOut) {
            throw new Error(`Referenced transaction output not found: ${txIn.txOutIndex}`);
          }
          if (referencedTxOut.address === address) {
            const unspentTxOut = new UTXO(txIn.txOutId, txIn.txOutIndex, referencedTxOut.amount);
            utxosSet.delete(unspentTxOut.stringify());
          }
        }
      }
    }

    const utxos = Array.from(utxosSet).map((json) => JSON.parse(json));
    const unspent: UnspentResult = {
      balance: utxos.reduce((acc, utxo) => acc + utxo.amount, 0),
      utxos: utxos
    }
    return unspent
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
    if (transaction.getId() !== transaction.id) {
      throw new Error(`Invalid id: ${transaction.id}, expected: ${transaction.getId()}`)
    }

    let totalTxIn = 0;
    let totalTxOut = 0;

    if (transaction.txIns.length === 0) {
      throw new Error(`Invalid transaction: must have at least one input`)
    }

    totalTxIn += this.miningReward;
    if (transaction.txIns.length === 1 && transaction.txIns[0].txOutId === '0' && transaction.txIns[0].txOutIndex === -1) {

    } else {
      for (const txIn of transaction.txIns) {
        const referencedTxOut = this.findTxOut(txIn.txOutId, txIn.txOutIndex);
        if (!referencedTxOut) {
          throw new Error(
            `Invalid transaction input: TxOut not found for TxIn with ID ${txIn.txOutId} at index ${txIn.txOutIndex}`,
          );
        }

        if (!txIn.verifySignature()) {
          throw new Error(
            `Invalid signature for TxIn`,
          );
        }

        for (const block of this.chain) { // yes yes very efficient kappa
          for (const tx of block.transactions) {
            for (const txIn2 of tx.txIns) {
              if (txIn2.txOutId === txIn.txOutId) {
                throw new Error(
                  `Invalid transaction input: TxOut already spent for TxIn with ID ${txIn.txOutId} at index ${txIn.txOutIndex}`,
                );
              }
            }
          }
        }

        totalTxIn += referencedTxOut.amount;
      }
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

  public findTxOut(txOutId: string, txOutIndex: number): TxOut | null {
    const txIdMap = new Map<string, Transaction>();
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        txIdMap.set(tx.getId(), tx);
      }
    }

    const referencedTx = txIdMap.get(txOutId);
    if (!referencedTx) {
      return null;
    }

    const referencedTxOut = referencedTx.txOuts[txOutIndex];
    if (!referencedTxOut) {
      return null;
    }

    return referencedTxOut;
  }

  private createGenesisBlock(): Block {
    // return new Block('0', [], this.difficulty);
    const serialized = '{"previousHash":"0","timestamp":1731965982450,"transactions":[],"hash":"d5303571b790f83168851382ca17fc67f00aea5b9e66aec99639fd1f32982344","nonce":0}';
    return Block.deserialize(serialized);
  }

  createCoinbaseTransaction(address: PublicKeyHash): Transaction {
    const blockHeight = this.chain.length;
    const coinbaseSignature = blockHeight.toString();
    const { publicKey } = Asymetric.genKeyPair()
    const dummyKeyObject = publicKey;
    const txIn = new TxIn('0', -1, dummyKeyObject, coinbaseSignature);
    const txOut = new TxOut(address, this.miningReward);
    return new Transaction([txIn], [txOut]);
  }
}
