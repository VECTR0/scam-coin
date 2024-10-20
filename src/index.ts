import { env } from './config';
import Server from './peer';

const peerServer = new Server();
peerServer.listen(env.PORT);
