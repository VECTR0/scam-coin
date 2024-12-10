import P2PServer from './peer';
import readline from 'readline';
import Wallet from './wallet';
import { Block, Blockchain, Transaction, TransPool, TxIn, TxOut } from './block';
import fs from 'fs';
import { Asymetric } from './util';

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

const transPool = new TransPool();
const blockchain = new Blockchain(2, 10);
const wallet = new Wallet();

peerServer.newBlockCallback = (serializedBlock) => {
    const block = Block.deserialize(serializedBlock);
    if (!blockchain.hasBlock(block)) {
        try {
            blockchain.verifyBlockchain()
            blockchain.add(block);
            peerServer.broadcastNewBlock(serializedBlock);
            transPool.removeTrans(block);
            console.log('New block received');
        } catch (e) {
            if (e instanceof Error)
                console.error(e.message);
        }
    }
};

peerServer.newTransactionCallback = (serializedTransaction) => {
    const transaction = Transaction.deserialize(serializedTransaction);
    if (!transPool.hasTrans(transaction)) { //TODO: check if transaction already in blockchain
        try {
            blockchain.verifyTransaction(transaction);
        } catch (e) {
            if (e instanceof Error)
                console.error(e.message);
            return;
        }

        transPool.add(transaction);
        peerServer.broadcastNewTransaction(serializedTransaction);
        console.log('New transaction received');
    }
};

peerServer.getBlockChainCallback = () => {
    return blockchain.getAll().map((block) => Block.serialize(block));
}

peerServer.getTransactionsPoolCallback = () => {
    return transPool.getAll().map((transaction) => Transaction.serialize(transaction));
}

rl.on('line', (input) => {
    const [command, ...args] = input.split(' ');
    switch (command) { //TODO: refactor to fancy dynamic options list
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
                wallet.loadFromFile(filename + ".wallet", password);
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
        case 'init':
            {
                wallet.create();
                console.log('Wallet created');
                break;
            }
        case 'save': {
            const [filename, password] = args;
            if (!filename || !password) {
                console.error('Filename and password required');
                break;
            }
            wallet.saveToFile(filename + ".wallet", password);
            console.log('saved');
            break;
        }
        case 'create': {
            try {
                wallet.createIdentity();
                console.log('Identity created');
            } catch (e) {
                if (e instanceof Error)
                    console.error(e.message);
            }
            break;
        }
        case 'list':
            const balances = wallet.getIdentities().map((identity) => {
                const { balance } = blockchain.getBalance(identity.address);
                return { address: identity.address, balance };
            });
            console.log('Wallet balances:');
            for(const balance of balances) {
                console.log(' ',balance.address, balance.balance);
            }
            console.warn('Private keys are not shown');
            break;
        case 'peers':
            console.log(peerServer.getNeighborsAddresses());
            break;
        case 'trans':
            {
                const [addressFrom, addressTo, amountStr] = args;
                if (!addressFrom || !addressTo || !amountStr) {
                    console.error('Identity and to and amount required');
                    break;
                }
                const amount = Number(amountStr);

                if (amount <= 0) { // TODO: check in processing new block
                    console.error('Amount must be positive');
                    break;
                }

                const identity = wallet.getIdentities().find((i) => i.address === addressFrom);
                if (!identity) {
                    console.error('Src Identity not found');
                    break;
                }

                const { privateKey, publicKey } = identity.keyPair;
                const { balance, utxos } = blockchain.getBalance(addressFrom);


                if (balance < amount) {
                    console.error('Not enough funds');
                    break;
                }

                const txIns = utxos.map((utxo) => {
                    const txIn = new TxIn(utxo.txOutId, utxo.txOutIndex, publicKey, null);
                    txIn.sign(privateKey);
                    return txIn;
                });

                const txOuts = [new TxOut(addressTo, amount)];
                if (balance > amount) {
                    const change = balance - amount;
                    const changeTxOut = new TxOut(addressFrom, change);
                    txOuts.push(changeTxOut);
                }

                const transaction = new Transaction(txIns, txOuts);

                try {
                    transPool.add(transaction);
                    const serializedTransaction = Transaction.serialize(transaction);
                    peerServer.broadcastNewTransaction(serializedTransaction);
                    console.log('Transaction added to mempool');
                } catch (e) {
                    if (e instanceof Error)
                        console.error(e.message);
                }
                break;
            }
        case 'mine':
            {
                let transaction = transPool.get()
                if (transaction === null) {
                    console.log('No transactions in pool');
                    console.log('Mining for reward...');
                    if (wallet.getIdentities().length === 0) {
                        console.error('No identities in wallet');
                        break;
                    }
                    transaction = blockchain.createCoinbaseTransaction(wallet.getIdentities()[0].address);
                } else {
                    transaction.addReward(wallet.getIdentities()[0].address, blockchain.miningReward);
                }
                try {
                    blockchain.verifyTransaction(transaction)
                } catch (e) {
                    if (e instanceof Error)
                        console.error(e.message);
                    transPool.drop();
                    break;
                }

                console.log('Mining in progress...');
                const block = blockchain.mine([transaction]);
                console.log('Mined block', block);
                transPool.removeTrans(block);
                peerServer.broadcastNewBlock(Block.serialize(block));
                break;
            }
        case 'pool':
            console.log(transPool.getAll());
            break;
        case 'chain':
            console.log(blockchain.getAll());
            break;
        case 'balance':
            {
                const [address] = args;
                if (!address) {
                    // list all wallet balances without utxos
                    const balances = wallet.getIdentities().map((identity) => {
                        const { balance } = blockchain.getBalance(identity.address);
                        return { address: identity.address, balance };
                    });
                    console.log('Wallet balances:');
                    for(const balance of balances) {
                        console.log(' ',balance.address, balance.balance);
                    }
                    break;
                }
                const { balance, utxos } = blockchain.getBalance(address);
                console.log('Balance:', balance);
                console.log('UTXOs:');
                for (const utxo of utxos) {
                    console.log(' ', utxo.txOutId + ':' + utxo.txOutIndex, utxo.amount);
                }
                break;
            }
        case 'money': { 
            const transactions = blockchain.getAll().map((block) => block.transactions).flat();
            for (const transaction of transactions) {
                console.log('TXID:', transaction.id);
                for (const txIn of transaction.txIns) { 
                    if (txIn.txOutId === '0') {
                        console.log('Coinbase transaction');
                    } else {
                        const txOut = blockchain.findTxOut(txIn.txOutId, txIn.txOutIndex);
                        if (txOut) {
                            console.log('TxIn:', txOut.address, txOut.amount, txIn.txOutId + ":" + txIn.txOutIndex);
                        }
                    }
                }
                for (const txOut of transaction.txOuts) {
                    console.log('TxOut:', txOut.address, txOut.amount);
                }
                console.log(' ');
            }

            break;
        }
        case 'help':
            console.log('Available commands:');
            console.log('debug - Toggle debug mode');
            console.log('clear - Clear console');
            console.log('dir - List wallet files');
            console.log('load <filename> <password> - Load wallet from file');
            console.log('reset - Reset wallet');
            console.log('save <filename> <password> - Save wallet to file (creates new if not exists)');
            console.log('init - Create new wallet');
            console.log('create - Create new identity and saves to wallet');
            console.log('list - List identities');
            console.log('peers - List connected peers');
            console.log('trans <identity> <to> <amount> - Add new transation');
            console.log('mine - Starts mining first transaction in mempool or coinbase transaction');
            console.log('pool - Prints transaction pool');
            console.log('chain - Prints blockchain');
            console.log('money - Prints all transactions');
            console.log('exit - Exit program');
            console.log('help - Show this help');
            console.log(' ');
            console.log('INITIAL SETUP:');
            console.log('init');
            console.log('create');
            break;
        default:
            console.warn('Unknown command');
            break;
    }
    console.log(' ');

    if (input === 'exit') {
        rl.close();
        process.exit(0);
    }
});