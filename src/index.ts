import P2PServer from './peer';

const peerServer = new P2PServer();

const args = process.argv.slice(2);
console.log(args);

let PORT = 0;
if (args.includes('--port')) {
  const portIndex = args.findIndex((arg) => arg === '--port');
  const port = Number(args[portIndex + 1]);
  if (isNaN(port)) {
    console.error('Port must be a number');
    process.exit(1);
  }
  console.log('Selected port', port);
  PORT = port;
}
peerServer.listen(PORT);

let connectToAddres = '';
if (args.includes('--connectTo')) {
  const portIndex = args.findIndex((arg) => arg === '--connectTo');
  const address = args[portIndex + 1];
  console.log('Connecting to', address);
  connectToAddres = address;
  peerServer.connectTo(connectToAddres);
}

// peerServer.connectTo(connectToAddres);
