import http from "node:http";
import net from "node:net";

// クラスにする理由は design-policy.md の原則 13
class SocketAgent extends http.Agent {
  readonly #socketPath: string;

  constructor(socketPath: string) {
    super({ keepAlive: true });
    this.#socketPath = socketPath;
  }

  override createConnection(): net.Socket {
    return net.connect(this.#socketPath);
  }
}

/** unix ソケットか名前付きパイプに繋ぐ Agent を返す。 */
export function socketAgentOf(socketPath: string): http.Agent {
  return new SocketAgent(socketPath);
}
