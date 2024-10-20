import { createServer, Socket, connect } from 'net';

enum PacketType {
  CONNECT = 0x01,
  GET_NEIGHBORS = 0x02,
  HEARTBEAT = 0x03,
}

enum PacketFlag {
  NONE = 0x00,
  REQUEST = 0x01,
  RESPONSE = 0x02,
}

type Packet = {
  type: PacketType;
  flag: PacketFlag;
  json: string;
}

type Neighbor = {
  address: string;
  listeningAddress?: string;
  lastHeartbeat: number;
  socket: Socket;
  isServer?: boolean;
  name?: string;
};

class Server {
  sockets: Socket[];
  neighbors: Neighbor[];
  port: number;
  address: string;
  tcpServer: any;
  name: string;


  constructor() {
    this.sockets = [];
    this.neighbors = [];
    this.port = 0;
    this.address = '';
    this.tcpServer = null;
    this.name = Date.now().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  addNewNeighbor(neighbor: Neighbor, incoming: boolean = false) {
    this.neighbors.push(neighbor);
    const socket = neighbor.socket;

    socket.on('end', () => {
      console.log('Client disconnected');
      this.neighbors = this.neighbors.filter((n) => n.address !== neighbor.address);
    });

    socket.on('error', (err) => {
      console.error(err);
    });

    let receiveBuffer = Buffer.alloc(0, 0);
    socket.on('data', (data) => {
      let waitingForPacket = true;
      let type = null;
      let flag = null;
      let len = -1;
      receiveBuffer = Buffer.concat([receiveBuffer, data]);
      while ((waitingForPacket && receiveBuffer.length >= 6) || (!waitingForPacket && receiveBuffer.length >= len)) {
        if (waitingForPacket) {
          if (receiveBuffer.length >= 6) {
            type = receiveBuffer.readUInt8(0);
            flag = receiveBuffer.readUInt8(1);
            len = receiveBuffer.readUint32LE(2);
            receiveBuffer = receiveBuffer.slice(6);
            waitingForPacket = false;
          }
        }
        if (!waitingForPacket) {
          let jsonData = null;
          if (receiveBuffer.length >= len) {
            jsonData = receiveBuffer.slice(0, len).toString('ascii');
            receiveBuffer = receiveBuffer.slice(len);
            waitingForPacket = true;
            const p = { type: type, flag: flag, json: jsonData };
            this.handleInfoPacket(p, neighbor);
          }
        }
      }
    });

    if (!incoming) {
      const mineListentingAddress = `${this.address}:${this.port}`;
      const info = {
        name: this.name,
        listeningAddress: mineListentingAddress,
      }
      this.send(socket, PacketType.CONNECT, PacketFlag.REQUEST, JSON.stringify(info));
    }
  }

  listen(port: number = 0) {
    this.tcpServer = createServer((socket) => {
      console.log(`===`,`Node connected from ${socket.remoteAddress}:${socket.remotePort}`);

      this.addNewNeighbor({
        address: `${socket.remoteAddress}:${socket.remotePort}`,
        listeningAddress: undefined,//not yet known
        lastHeartbeat: Date.now(),
        socket: socket,
        isServer: false,
      }, true);
    });

    this.tcpServer.listen(port, '0.0.0.0', () => {
      this.port = this.tcpServer.address().port;
      this.address = this.tcpServer.address().address;
      console.log(`Node listening on port ${this.address}:${this.port}`);
    }
    );

    setInterval(() => {
      console.log('===', 'Current neighbors:');
      this.neighbors.forEach((n) => {
        console.log('===', `- ${n.name} ${n.listeningAddress} (${n.address})`);
      });
    }, Math.floor(Math.random() * 2000) + 4000);


    setInterval(() => { 
      for (let neighbor of this.neighbors) {
        this.send(neighbor.socket, PacketType.HEARTBEAT, PacketFlag.NONE, JSON.stringify({}));
      }

      for (let neighbor of this.neighbors) {
        if (Date.now() - neighbor.lastHeartbeat > 10000) {
          console.log(`Neighbor ${neighbor.address} is dead`);
          neighbor.socket.destroy();
          this.neighbors = this.neighbors.filter((n) => n.address !== neighbor.address);
        }
      }
    }, Math.floor(Math.random() * 2000) + 4000);

    setInterval(() => { 
      if (this.neighbors.length < 3) {
        for (let neighbor of this.neighbors) {
          this.send(neighbor.socket, PacketType.GET_NEIGHBORS, PacketFlag.REQUEST, JSON.stringify({}));
        }
      }
    }, Math.floor(Math.random() * 2000) + 4000);
  }

  connectTo(address: string) {
    const [ip, port] = address.split(':');
    const socket = connect(Number(port), ip, () => {
      console.log(`Connected to node ${address}`);
      const neighbor = {
        address: address,
        listeningAddress: address,
        lastHeartbeat: Date.now(),
        socket: socket,
        isServer: true,
      };
      this.addNewNeighbor(neighbor);
    });
  }

  send(socket: Socket, type: PacketType, flag: any, data?: string) {
    if (socket.destroyed) return;
    let b = Buffer.alloc(6);
    b.writeUInt8(type, 0);
    b.writeUInt8(flag, 1);
    b.writeUInt32LE(data ? data.length : 0, 2);
    if (data) b = Buffer.concat([b, Buffer.from(data, 'ascii')]);
    socket.write(b);
    console.log('>>>', PacketType[type], socket.remoteAddress + ':' + socket.remotePort, data);
  }

  private handleInfoPacket(packet: any, neighbor: Neighbor) {
    console.log('<<<', PacketType[packet.type], PacketFlag[packet.flag], neighbor.address, packet.json);
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
          }
          this.send(neighbor.socket, PacketType.CONNECT, PacketFlag.RESPONSE, JSON.stringify(mineInfo));
        } else if (packet.flag === PacketFlag.RESPONSE) {
          const info = JSON.parse(packet.json);
          neighbor.name = info.name;
          neighbor.listeningAddress = info.listeningAddress;
        }
        break;
      case PacketType.GET_NEIGHBORS:
        if (packet.flag === PacketFlag.RESPONSE) {
          function shuffle(arr: any) {
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * i)
              const temp = arr[i]
              arr[i] = arr[j]
              arr[j] = temp
            }
            return arr;
          }

          const neighbors = JSON.parse(packet.json); // list of name and addreses of servers
          
          shuffle(neighbors.filter((n: any) => n.name !== this.name && !this.neighbors.some((ne) => ne.name === n.name))).forEach((n: any) => {
            if(this.neighbors.length >= 5) return;
            const [ip, port] = n.address.split(':');
            console.log(`New neighbor ${ip}:${port}`);
            try {
              const socket = connect(Number(port), ip, () => {
                console.log(`Connected to ${n}`);
                const neighbor = {
                  address: n,
                  listeningAddress: n,
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
          this.send(neighbor.socket, PacketType.GET_NEIGHBORS, PacketFlag.RESPONSE, JSON.stringify(neighbors));
        }
        break;
      case PacketType.HEARTBEAT:
        neighbor.lastHeartbeat = Date.now();
        break;
      default:
        console.log(`!!!`, `Unknown packet type: ${packet.type}`);
    }
  }

  sendToAllNeighbors(type: PacketType, flag: PacketFlag, data: string) {
    this.neighbors.forEach((n) => {
      try{
      this.send(n.socket, type, flag, data);
      } catch(e) {
        console.error(e);
      }
    });
  }

  getNeighborsAddresses() { // return []
    return this.neighbors.map((n) => ({ name: n.name, address: n.isServer ? n.address : n.listeningAddress })).filter((n) => n.name !== undefined && n.address !== undefined);
  }

  updateBlockchain() {
    // check local version
  }
  blockCreated() {
    // notify neighbors
  }
}

export default Server;
