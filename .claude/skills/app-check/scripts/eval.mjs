// 開発用の DockerGUI の画面の中で、式を 1 つ実行し、結果を JSON で書き出す。
// 使い方: node eval.mjs '<式>' [--change-settings]
// 式が Promise を返すときは、解決するまで待つ。画面の中では window.api（main の口）を呼べる。
const expression = process.argv[2];
if (!expression) {
  console.error("実行する式を渡す");
  process.exit(1);
}
// why: Skill の app-check の「設定を変えない」。設定を変える口（app:set で始まる口）を呼ぶ式は、式の後に --change-settings を渡したときだけ実行する。
const changed = [...new Set(expression.match(/app:set[A-Za-z]+/g) ?? [])];
if (changed.length > 0 && process.argv[3] !== "--change-settings") {
  console.error(
    `設定を変える口（${changed.join("、")}）を呼ぶ式は実行しない。開発用のアプリは、利用者のアプリと設定ファイルを共有している。` +
      "利用者のアプリが動いていないことを確かめたうえで、式の後に --change-settings を付けて実行する",
  );
  process.exit(1);
}
const targets = await (await fetch("http://127.0.0.1:9333/json")).json();
const page = targets.find((target) => target.type === "page");
if (!page) {
  console.error("画面が見つからない。dev-start.sh で起動したか確かめる");
  process.exit(1);
}
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve));
socket.send(
  JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: { expression, returnByValue: true, awaitPromise: true },
  }),
);
const message = await new Promise((resolve) =>
  socket.addEventListener("message", (event) => resolve(JSON.parse(event.data))),
);
socket.close();
if (message.result?.exceptionDetails) {
  console.error(JSON.stringify(message.result.exceptionDetails, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(message.result?.result?.value, null, 2));
