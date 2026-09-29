import net from "node:net";

/** socketPath のソケットに繋がるかを確かめる。繋がったら、すぐに閉じる。例外を投げない。 */
export function isSocketAccepting(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(socketPath);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
