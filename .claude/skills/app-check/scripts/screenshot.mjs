// 開発用の DockerGUI の画面の写真を、PNG のファイルに書き出す。
// 使い方: node screenshot.mjs <書き出す先のファイル>
import { writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("書き出す先のファイルを渡す");
  process.exit(1);
}
const targets = await (await fetch("http://127.0.0.1:9333/json")).json();
const page = targets.find((target) => target.type === "page");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve));
socket.send(
  JSON.stringify({ id: 1, method: "Page.captureScreenshot", params: { format: "png" } }),
);
const message = await new Promise((resolve) =>
  socket.addEventListener("message", (event) => resolve(JSON.parse(event.data))),
);
socket.close();
writeFileSync(file, Buffer.from(message.result.data, "base64"));
console.log(file);
