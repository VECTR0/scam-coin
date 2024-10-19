import Block from './block';
import Server from './peer';

const b = new Block(3, 'prev', Date.now(), 'data', 56, 60);
const PORT = process.env.PORT || 3000;

console.log(b.calculateHash());

const peerServer = new Server();

peerServer.listen(PORT);
