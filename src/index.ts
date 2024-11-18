import P2PServer from './peer';
import readline from 'readline';
import Wallet from './wallet';
import fs from 'fs';

const peerServer = new P2PServer();

const programArgs = process.argv.slice(2);
console.log(programArgs);

let PORT = 0;
if (programArgs.includes('--port')) {
  const portIndex = programArgs.findIndex((arg) => arg === '--port');
  const port = Number(programArgs[portIndex + 1]);
  if (isNaN(port)) {
    console.error('Port must be a number');
    process.exit(1);
  }
  console.log('Selected port', port);
  PORT = port;
}
peerServer.listen(PORT);

let connectToAddres = '';
if (programArgs.includes('--connectTo')) {
  const portIndex = programArgs.findIndex((arg) => arg === '--connectTo');
  const address = programArgs[portIndex + 1];
  console.log('Connecting to', address);
  connectToAddres = address;
  peerServer.connectTo(connectToAddres);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const wallet = new Wallet();
rl.on('line', (input) => {

    const [command, ...args] = input.split(' ');
    switch (command) {
        case 'debug':
            peerServer.showDebug = !peerServer.showDebug;
            console.log('Debug mode:', peerServer.showDebug);
            break;
        case 'clear':
            console.clear();
            console.log('Console cleared');
            break;
        case 'dir':
            {
                let files = fs.readdirSync('./wallets');
                files = files.filter((file) => file.endsWith('.dat'));
                console.log(files);
                break;
            }
        case 'load': {
            const [filename, password] = args;
            try {
                wallet.loadFromFile(filename, password);
                console.log('loaded');
            } catch (e) {
                if (e instanceof Error) {
                    console.error(e.message);
                } else {
                    console.error('loading failure');
                }
            }
            break;
        }
        case 'reset':
            wallet.reset();
            console.log('Wallet reseted');
            break;
        case 'save': {
            const [filename, password] = args;
            if (!filename || !password) {
                console.error('Filename and password required');
                break;
            }
            wallet.saveToFile(filename, password);
            console.log('saved');
            break;
        }
        case 'create': {
            try {
                wallet.createIdentity();
            } catch (e) {
                if (e instanceof Error)
                    console.error(e.message);
            }
            console.log('Identity created');
            break;
        }
        case 'list':
            console.log(wallet.getIdentities().map((i) => ({ address: i.address, publicKey: i.keyPair.publicKey })));
            console.warn('Private keys are not shown');
            break;
        case 'peers':
            console.log(peerServer.getNeighborsAddresses());
            break;
        case 'help':
            console.log('Available commands:');
            console.log('debug - Toggle debug mode');
            console.log('clear - Clear console');
            console.log('dir - List wallet files');
            console.log('load <filename> <password> - Load wallet from file');
            console.log('reset - Reset wallet');
            console.log('save <filename> <password> - Save wallet to file');
            console.log('create - Create new identity and saves to wallet');
            console.log('list - List identities');
            console.log('peers - List connected peers');
            console.log('exit - Exit program');
            break;
        default:
            console.warn('Unknown command');
            break;
    }
    case 'reset':
      wallet.reset();
      console.log('Wallet reseted');
      break;
    case 'save': {
      const [filename, password] = args;
      if (!filename || !password) {
        console.error('Filename and password required');
        break;
      }
      wallet.saveToFile(filename, password);
      console.log('saved');
      break;
    }
    case 'create': {
      try {
        wallet.createIdentity();
      } catch (e: any) {
        console.error(e.message);
      }
      console.log('Identity created');
      break;
    }
    case 'list':
      console.log(
        wallet
          .getIdentities()
          .map((i) => ({ address: i.address, publicKey: i.keyPair.publicKey })),
      );
      console.warn('Private keys are not shown');
      break;
    case 'peers':
      console.log(peerServer.getNeighborsAddresses());
      break;
    case 'help':
      console.log('Available commands:');
      console.log('debug - Toggle debug mode');
      console.log('clear - Clear console');
      console.log('dir - List wallet files');
      console.log('load <filename> <password> - Load wallet from file');
      console.log('reset - Reset wallet');
      console.log('save <filename> <password> - Save wallet to file');
      console.log('create - Create new identity and saves to wallet');
      console.log('list - List identities');
      console.log('peers - List connected peers');
      console.log('exit - Exit program');
      break;
    default:
      console.warn('Unknown command');
      break;
  }

  if (input === 'exit') {
    rl.close();
    process.exit(0);
  }
});
