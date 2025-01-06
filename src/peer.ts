import { createServer, Socket, connect, Server, AddressInfo } from 'net';

export enum PacketType {
  CONNECT = 0x01,
  GET_NEIGHBORS = 0x02,
  HEARTBEAT = 0x03,
  NEW_TRANSACTION = 0x04,
  NEW_BLOCK = 0x05,
  GET_TRANSACTIONS_POOL = 0x06,
  GET_BLOCKCHAIN = 0x07,
}

export enum PacketFlag {
  NONE = 0x00,
  REQUEST = 0x01,
  RESPONSE = 0x02,
}

export type Packet = {
  type: PacketType;
  flag: PacketFlag;
  json: string;
};

type PacketJsonStringify = {
  name: string;
  address: string;
};

export type Neighbor = {
  address: string;
  listeningAddress?: string;
  lastHeartbeat: number;
  socket: Socket;
  isServer?: boolean;
  name?: string;
};

class P2PServer {
  neighbors: Neighbor[];
  port: number;
  address: string;
  tcpServer: Server | null;
  name: string;
  showDebug: boolean = false;
  newTransactionCallback: (serializedTransaction: string) => void;
  newBlockCallback: (serializedBlock: string) => void;
  getBlockChainCallback: () => string[];
  getTransactionsPoolCallback: () => string[];

  constructor() {
    this.neighbors = [];
    this.port = 0;
    this.address = '';
    this.tcpServer = null;
    this.name =
      Date.now().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    this.newTransactionCallback = () => {};
    this.newBlockCallback = () => {};
    this.getBlockChainCallback = () => [];
    this.getTransactionsPoolCallback = () => [];
  }

  log(...args: unknown[]) {
    if (this.showDebug) {
      console.log(...args);
    }
  }

  addNewNeighbor(neighbor: Neighbor, incoming: boolean = false) {
    this.neighbors.push(neighbor);
    const socket = neighbor.socket;

    socket.on('end', () => {
      this.log('Client disconnected');
      this.neighbors = this.neighbors.filter(
        (n) => n.address !== neighbor.address,
      );
    });

    socket.on('error', (err) => {
      console.error(err);
    });

    let receiveBuffer = Buffer.alloc(0, 0);
    socket.on('data', (data) => {
      let waitingForPacket = true;
      let type: PacketType | null = null;
      let flag: PacketFlag | null = null;
      let len: number = -1;
      receiveBuffer = Buffer.concat([receiveBuffer, data]);
      while (
        (waitingForPacket && receiveBuffer.length >= 6) ||
        (!waitingForPacket && receiveBuffer.length >= len)
      ) {
        if (waitingForPacket) {
          if (receiveBuffer.length >= 6) {
            type = receiveBuffer.readUInt8(0) as PacketType;
            flag = receiveBuffer.readUInt8(1) as PacketFlag;
            len = receiveBuffer.readUint32LE(2);
            receiveBuffer = receiveBuffer.slice(6);
            waitingForPacket = false;
          }
        }

        if (!waitingForPacket) {
          if (receiveBuffer.length >= len) {
            const jsonData = receiveBuffer.slice(0, len).toString('ascii');
            receiveBuffer = receiveBuffer.slice(len);
            waitingForPacket = true;

            const packet: Packet = { type: type!, flag: flag!, json: jsonData };

            this.handleInfoPacket(packet, neighbor);
          }
        }
      }
    });

    if (!incoming) {
      const mineListentingAddress = `${this.address}:${this.port}`;
      const info = {
        name: this.name,
        listeningAddress: mineListentingAddress,
      };
      this.send(
        socket,
        PacketType.CONNECT,
        PacketFlag.REQUEST,
        JSON.stringify(info),
      );
    }
  }

  listen(port: number = 0) {
    this.tcpServer = createServer((socket) => {
      this.log(
        `===`,
        `Node connected from ${socket.remoteAddress}:${socket.remotePort}`,
      );

      this.addNewNeighbor(
        {
          address: `${socket.remoteAddress}:${socket.remotePort}`,
          listeningAddress: undefined, //not yet known
          lastHeartbeat: Date.now(),
          socket: socket,
          isServer: false,
        },
        true,
      );
    });

    this.tcpServer.listen(port, '0.0.0.0', () => {
      const { port, address } = this.tcpServer!.address() as AddressInfo;
      this.port = port;
      this.address = address;
      this.log(`Node listening on portdd ${this.address}:${this.port}`);
    });

    setInterval(
      () => {
        this.log('===', 'Current neighbors:');
        this.neighbors.forEach((n) => {
          this.log('===', `- ${n.name} ${n.listeningAddress} (${n.address})`);
        });
      },
      Math.floor(Math.random() * 2000) + 4000,
    );

    setInterval(
      () => {
        for (const neighbor of this.neighbors) {
          this.send(
            neighbor.socket,
            PacketType.HEARTBEAT,
            PacketFlag.NONE,
            JSON.stringify({}),
          );
        }

        for (const neighbor of this.neighbors) {
          if (Date.now() - neighbor.lastHeartbeat > 10000) {
            this.log(`Neighbor ${neighbor.address} is dead`);
            neighbor.socket.destroy();
            this.neighbors = this.neighbors.filter(
              (n) => n.address !== neighbor.address,
            );
          }
        }
      },
      Math.floor(Math.random() * 2000) + 4000,
    );

    setInterval(
      () => {
        if (this.neighbors.length < 3) {
          for (const neighbor of this.neighbors) {
            this.send(
              neighbor.socket,
              PacketType.GET_NEIGHBORS,
              PacketFlag.REQUEST,
              JSON.stringify({}),
            );
          }
        }
      },
      Math.floor(Math.random() * 2000) + 4000,
    );
  }

  public connectTo(address: string) {
    const [ip, port] = address.split(':');
    const socket = connect(Number(port), ip, () => {
      this.log(`Connected to node ${address}`);
      const neighbor = {
        address: address,
        listeningAddress: address,
        lastHeartbeat: Date.now(),
        socket: socket,
        isServer: true,
      };
      this.addNewNeighbor(neighbor);
      this.send(socket, PacketType.GET_BLOCKCHAIN, PacketFlag.REQUEST);
      this.send(socket, PacketType.GET_TRANSACTIONS_POOL, PacketFlag.REQUEST);
    });
  }

  public send(
    socket: Socket,
    type: PacketType,
    flag: PacketFlag,
    data?: string,
  ) {
    if (socket.destroyed) return;
    let b = Buffer.alloc(6);
    b.writeUInt8(type, 0);
    b.writeUInt8(flag, 1);
    b.writeUInt32LE(data ? data.length : 0, 2);
    if (data) b = Buffer.concat([b, Buffer.from(data, 'ascii')]);
    socket.write(b);
    this.log(
      '>>>',
      PacketType[type],
      socket.remoteAddress + ':' + socket.remotePort,
      data,
    );
  }

  private sendToAll(type: PacketType, flag: PacketFlag, data: string) {
    this.neighbors.forEach((n) => {
      this.send(n.socket, type, flag, data);
    });
  }

  private handleInfoPacket(packet: Packet, neighbor: Neighbor) {
    this.log(
      '<<<',
      PacketType[packet.type],
      PacketFlag[packet.flag],
      neighbor.address,
      packet.json,
    );
    switch (packet.type) {
      case PacketType.CONNECT:
        if (packet.flag === PacketFlag.REQUEST) {
          const info = JSON.parse(packet.json);
          neighbor.name = info.name;
          neighbor.listeningAddress = info.listeningAddress;
          //send back own info
          const mineListentingAddress = `${this.address}:${this.port}`;
          const mineInfo = {
            name: this.name,
            listeningAddress: mineListentingAddress,
          };
          this.send(
            neighbor.socket,
            PacketType.CONNECT,
            PacketFlag.RESPONSE,
            JSON.stringify(mineInfo),
          );
        } else if (packet.flag === PacketFlag.RESPONSE) {
          const info = JSON.parse(packet.json);
          neighbor.name = info.name;
          neighbor.listeningAddress = info.listeningAddress;
        }
        break;
      case PacketType.GET_NEIGHBORS:
        if (packet.flag === PacketFlag.RESPONSE) {
          function shuffle<T>(arr: T[]): T[] {
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * i);
              const temp = arr[i];
              arr[i] = arr[j];
              arr[j] = temp;
            }
            return arr;
          }

          const neighbors = JSON.parse(packet.json) as PacketJsonStringify[]; // list of name and addreses of servers

          shuffle(
            neighbors.filter(
              (n) =>
                n.name !== this.name &&
                !this.neighbors.some((ne) => ne.name === n.name),
            ),
          ).forEach((n) => {
            if (this.neighbors.length >= 5) return;
            const { address } = n;
            const [ip, port] = address.split(':');
            this.log(`New neighbor ${ip}:${port}`);
            try {
              const socket = connect(Number(port), ip, () => {
                const neighbor: Neighbor = {
                  address,
                  listeningAddress: address,
                  lastHeartbeat: Date.now(),
                  socket: socket,
                };
                this.addNewNeighbor(neighbor);
              });
            } catch (e) {
              console.error(e);
            }
          });
        } else if (packet.flag === PacketFlag.REQUEST) {
          const neighbors = this.getNeighborsAddresses();
          this.send(
            neighbor.socket,
            PacketType.GET_NEIGHBORS,
            PacketFlag.RESPONSE,
            JSON.stringify(neighbors),
          );
        }
        break;
      case PacketType.HEARTBEAT:
        neighbor.lastHeartbeat = Date.now();
        break;
      case PacketType.NEW_TRANSACTION:
        this.newTransactionCallback(packet.json);
        break;
      case PacketType.NEW_BLOCK:
        this.newBlockCallback(packet.json);
        break;
      case PacketType.GET_TRANSACTIONS_POOL:
        if (packet.flag === PacketFlag.REQUEST) {
          const transactions = this.getTransactionsPoolCallback();
          for (const transaction of transactions) {
            this.send(
              neighbor.socket,
              PacketType.NEW_TRANSACTION,
              PacketFlag.RESPONSE,
              transaction,
            );
          }
        }
        break;
      case PacketType.GET_BLOCKCHAIN:
        if (packet.flag === PacketFlag.REQUEST) {
          const blocks = this.getBlockChainCallback();
          for (const block of blocks) {
            this.send(
              neighbor.socket,
              PacketType.NEW_BLOCK,
              PacketFlag.RESPONSE,
              block,
            );
          }
        }
        break;
      default:
        this.log(`!!!`, `Unknown packet type: ${packet.type}`);
    }
  }

  private sendToAllNeighbors(type: PacketType, flag: PacketFlag, data: string) {
    this.neighbors.forEach((n) => {
      try {
        this.send(n.socket, type, flag, data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public getNeighborsAddresses() {
    return this.neighbors
      .map((n) => ({
        name: n.name,
        address: n.isServer ? n.address : n.listeningAddress,
      }))
      .filter((n) => n.name !== undefined && n.address !== undefined);
  }

  public broadcastNewTransaction(serializedTransaction: string) {
    this.sendToAllNeighbors(
      PacketType.NEW_TRANSACTION,
      PacketFlag.NONE,
      serializedTransaction,
    );
  }

  public broadcastNewBlock(serializedBlock: string) {
    this.sendToAllNeighbors(
      PacketType.NEW_BLOCK,
      PacketFlag.NONE,
      serializedBlock,
    );
  }
}

export default P2PServer;
