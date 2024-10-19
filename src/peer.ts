import { createServer, Socket, connect } from 'net';

type Neigbour = {
  ip: string; // "IP:PORT"
  lastHeartbeat: number;
};

class Server {
  sockets: Socket[];
  neigbours: Neigbour[];

  constructor() {
    this.sockets = [];
    this.neigbours = [];
  }

  listen(port: number = 3000) {
    const tcpServer = createServer((socket) => {
      socket.on('connect', () => {
        console.log(`a client connected ${this.neigbours}`);
      });
      this.connectSocket(socket);

      socket.on('data', (clientData) => {
        console.log(`client sent ${clientData}`);
      });

      socket.on('end', () => {
        console.log('Client disconnected');
      });
    });

    tcpServer.listen(port, 'localhost');
    this.connectPeers();
  }

  private connectSocket(socket: Socket) {
    this.sockets.push(socket);
    console.log(`socket: ${socket} connected`);
  }

  connectPeers() {
    const PEERS = [
      'ws://localhost:3001',
      'ws://localhost:3002',
      'ws://localhost:3003',
    ];
    PEERS.forEach((peer) => {
      console.log('fff');
      const socket = connect(peer);
      socket.on('open', () => {
        this.connectSocket(socket);
      });
    });
  }

  getNeighbours() {}
  heartbeat() {
    // ping - setInterval and check if is dead
  }
  updateBlockchain() {
    // check local version
  }
  blockCreated() {
    // notify neigbours
  }
}

export default Server;
