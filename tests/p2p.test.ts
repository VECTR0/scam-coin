import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import P2PServer, { Neighbor } from '../src/peer';
import { Block, Blockchain, Transaction, TxIn, TxOut } from '../src/block';
import { Socket } from 'net';
import winston from 'winston';
import { Asymetric } from '../src/util';

describe('P2P', () => {
  const logger = winston.createLogger({
    level: 'info',
    transports: [new winston.transports.Console()],
  });

  class MessageStore<T> {
    private messages: Map<string, T[]>;

    constructor() {
      this.messages = new Map();
    }
    push(socket: Socket, message: T): void {
      const socketAddress = this.getSocketAddr(socket);

      // Ensure the array for this address exists, or initialize it
      if (!this.messages.has(socketAddress)) {
        this.messages.set(socketAddress, []);
      }

      this.messages.get(socketAddress)!.push(message);
    }

    getMessages(socket: Socket): T[] | undefined {
      const socketAddress = this.getSocketAddr(socket);
      return this.messages.get(socketAddress);
    }

    getMap(): Map<string, T[]> {
      return this.messages;
    }

    popLatest(socket: Socket): T | undefined {
      const socketAddress = this.getSocketAddr(socket);
      const messages = this.messages.get(socketAddress);
      if (!messages || messages.length === 0) {
        return undefined;
      }
      return messages.pop();
    }

    private getSocketAddr(socket: Socket): string {
      return `${socket.remoteAddress}:${socket.remotePort}`;
    }
  }

  type Msg = {
    type: number;
    flag: number;
    data: string;
  };
  function splitReceivedData(receivedBuffer: Buffer): Msg {
    if (receivedBuffer.length < 6) {
      throw new Error('Received data is too short to contain required fields');
    }

    const type = receivedBuffer.readUInt8(0);
    const flag = receivedBuffer.readUInt8(1);
    const dataLength = receivedBuffer.readUInt32LE(2);

    const data =
      dataLength > 0
        ? receivedBuffer.slice(6, 6 + dataLength).toString('ascii')
        : '';

    return { type, flag, data };
  }

  const PORT = 37898;
  let server: P2PServer;

  let n1: Neighbor;
  let n2: Neighbor;

  const msgs = new MessageStore<Msg>();

  function waitForAndPopLatestMessage(socket: Socket) {
    return new Promise((resolve) => {
      // Attempt to pop the latest message immediately
      const latestMessage = msgs.popLatest(socket);
      if (latestMessage) {
        resolve(latestMessage);
      } else {
        // Wait for a message if none are available
        const interval = setInterval(() => {
          const nextMessage = msgs.popLatest(socket);
          if (nextMessage) {
            resolve(nextMessage);
            clearInterval(interval); // Stop checking once a message is found
          }
        }, 100);
      }
    });
  }

  async function newNeighbor(port: number) {
    const socket = new Socket();

    await new Promise<void>((resolve) => {
      socket.connect(port, 'localhost', resolve);
    });

    socket.on('data', (data) => {
      if (!data) return;
      const { type, flag, data: data_ } = splitReceivedData(data);
      if (data_) {
        msgs.push(socket, { type, flag, data: data_ });
      }
    });

    const nei: Neighbor = {
      address: `${socket.remoteAddress}:${socket.remotePort}`,
      lastHeartbeat: Date.now(),
      socket,
    };
    return nei;
  }

  async function setupNet() {
    server = new P2PServer();
    server.listen(PORT);

    n1 = await newNeighbor(PORT);
    n2 = await newNeighbor(PORT);
  }

  before(async () => {
    await setupNet();
  });

  after(() => {
    // n1.socket.destroy();
    // n2.socket.destroy();
    // server.tcpServer?.close();
  });

  it('test broadcast transaction', async () => {
    const tx1 = new Transaction(
      [
        new TxIn(
          '0x548973455039458',
          10,
          Asymetric.genKeyPair().publicKey,
          'sig',
        ),
      ],
      [new TxOut('0x548973404239458', 12)],
    );

    const tx2 = new Transaction(
      [
        new TxIn(
          '1x548973455039458',
          110,
          Asymetric.genKeyPair().publicKey,
          'sig2',
        ),
      ],
      [new TxOut('1x548973404239458', 102)],
    );

    server.broadcastNewTransaction(Transaction.serialize(tx1));
    server.broadcastNewTransaction(Transaction.serialize(tx2));

    const tx1_n1 = (await waitForAndPopLatestMessage(n1.socket)) as Msg;
    const tx1_n2 = (await waitForAndPopLatestMessage(n2.socket)) as Msg;

    const tx2_n1 = (await waitForAndPopLatestMessage(n1.socket)) as Msg;
    const tx2_n2 = (await waitForAndPopLatestMessage(n2.socket)) as Msg;

    assert.deepStrictEqual(tx1, Transaction.deserialize(tx1_n1.data));
    assert.deepStrictEqual(tx1, Transaction.deserialize(tx1_n2.data));

    assert.deepStrictEqual(tx1, Transaction.deserialize(tx2_n1.data));
    assert.deepStrictEqual(tx1, Transaction.deserialize(tx2_n2.data));

    // TODO FIXME: KeyObject serialization
  });

  it('test broadcast block', async () => {
    const blockchain = new Blockchain(2, 2);
    const blockGenesis = blockchain.getAll()[0];

    server.broadcastNewTransaction(Block.serialize(blockGenesis));

    const b1_n1 = (await waitForAndPopLatestMessage(n1.socket)) as Msg;
    const b1_n2 = (await waitForAndPopLatestMessage(n2.socket)) as Msg;

    assert.deepStrictEqual(blockGenesis, Block.deserialize(b1_n1.data));
    assert.deepStrictEqual(blockGenesis, Block.deserialize(b1_n2.data));
  });
});
