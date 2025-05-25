# scam-coin

**scam-coin** is an imaginary cryptocurrency created as a university project

# Features

- Dynamic P2P network with self-healing capability  
- Blockchain with synchronization for newly added nodes  
- Encrypted wallets with identity management  
- Transaction pool using UTXO model  
- Mining with Proof of Work verification  
- Safe and interactive CLI control panel  

# Usage

> **IMPORTANT** ensure network connectivity between nodes
---

## Setting up P2P network

1. `npm run start:dev:root` start a root node
2. `npm run start:dev:a` start a new node

> **IMPORTANT** by defult root node will be listening on `--port 13370` and new node will connect to it `--connectTo localhost:13370`
---

## Blockchain CLI usage

Available commands:
- `debug` - Toggle debug mode
- `clear` - Clear console
- `dir` - List wallet files
- `load` <filename> <password> - Load wallet from file
- `reset` - Reset wallet
- `save` <filename> <password> - Save wallet to file (creates new if not exists)
- `init` - Create new wallet
- `create` - Create new identity and saves to wallet
- `list` - List identities
- `peers` - List connected peers
- `trans` <identity> <to> <amount> - Add new transation
- `mine` - Starts mining first transaction in mempool or coinbase transaction
- `pool` - Prints transaction pool
- `chain` - Prints blockchain
- `money` - Prints all transactions
- `exit` - Exit program
- `help` - Show this help

# Instalation

> **IMPORTANT** ensure [NodeJS](https://nodejs.org/en) is installed
---
```
git clone git@github.com:VECTR0/scam-coin.git
cd scam-coin
npm install
```
