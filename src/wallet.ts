import { randomUUID } from 'crypto';

type Identity = {
  address: string;
  privateKey: string;
  secureKey: string;
};

class Wallet {
  password: string | undefined;
  identities: Identity[] | undefined;
  uuid: string | undefined;
  saveCounter: number;

  constructor() {
    this.password = undefined;
    this.identities = undefined;
    this.uuid = undefined;
    this.saveCounter = 0;
  }

  loadFromFile(filename: string, password: string) {
    console.log(filename);
    console.log(password);
  }

  saveToFile(filename: string, password?: string) {
    console.log(filename);
    console.log(password);
  }

  create(password: string) {
    //check if there is currently loaded wallet
    this.uuid = randomUUID();
    this.saveCounter = 0;
    // TODO
    console.log(password);
  }

  createIdentity() {
    //creates new KeyPair
    //trigger saveToFile for safety reasons
  }
}

export default Wallet;
