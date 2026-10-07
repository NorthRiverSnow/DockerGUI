import { describe, expect, it } from "vite-plus/test";
import {
  commandTextOf,
  dateTimeTextOf,
  DETAIL_MESSAGES,
  mountTextOf,
  portTextOf,
} from "./detail-messages";

describe("commandTextOf", () => {
  it.each([
    [["nginx", "-g", "daemon off;"], "nginx -g 'daemon off;'"],
    [["sh", "-c", "npm run dev"], "sh -c 'npm run dev'"],
    [["sh", "-c", "echo 'hi'"], `sh -c 'echo '\\''hi'\\'''`],
    [["node", ""], "node ''"],
    [
      ["/usr/bin/env", "KEY=a,b", "user@host:8080/path_x+y%"],
      "/usr/bin/env KEY=a,b user@host:8080/path_x+y%",
    ],
  ])("%j を、シェルに貼り付けて同じ引数になる 1 行 %s にする", (command, expected) => {
    expect(commandTextOf(command)).toBe(expected);
  });
});

describe("dateTimeTextOf", () => {
  it("ローカルの時刻を、年月日と時分秒の形にする。1 桁の月日と時分秒は 0 で埋める", () => {
    expect(dateTimeTextOf(new Date(2026, 0, 5, 3, 4, 9).getTime())).toBe("2026-01-05 03:04:09");
  });
});

describe("portTextOf と mountTextOf", () => {
  it("ポートを、外のポートとコンテナの中のポートとプロトコルの形にする", () => {
    expect(portTextOf({ publicPort: 5353, privatePort: 53, protocol: "udp" })).toBe(
      "5353 → 53/udp",
    );
  });

  it.each([
    [{ mountType: "volume", source: "shop_data", destination: "/data" }, "shop_data → /data"],
    [{ mountType: "tmpfs", source: "", destination: "/tmp" }, "tmpfs → /tmp"],
  ])("マウント %j を %s にする", (mount, expected) => {
    expect(mountTextOf(mount)).toBe(expected);
  });
});

describe("DETAIL_MESSAGES", () => {
  it.each([
    ["ja", { name: "unless-stopped", maximumRetryCount: 0 }, "unless-stopped"],
    ["ja", { name: "on-failure", maximumRetryCount: 3 }, "on-failure（最大 3 回）"],
    ["ja", { name: "on-failure", maximumRetryCount: 0 }, "on-failure（回数の上限なし）"],
    ["en", { name: "always", maximumRetryCount: 0 }, "always"],
    ["en", { name: "on-failure", maximumRetryCount: 1 }, "on-failure (up to 1 retry)"],
    ["en", { name: "on-failure", maximumRetryCount: 3 }, "on-failure (up to 3 retries)"],
    ["en", { name: "on-failure", maximumRetryCount: 0 }, "on-failure (no retry limit)"],
  ] as const)("%s で、再起動の設定 %j を %s にする", (language, policy, expected) => {
    expect(DETAIL_MESSAGES[language].restartPolicy(policy)).toBe(expected);
  });

  it.each([
    [
      "ja",
      "ネットワーク shop_default の名前をコピー",
      "ネットワーク shop_default の IP アドレスをコピー",
    ],
    ["en", "Copy the name of network shop_default", "Copy the IP address on network shop_default"],
  ] as const)(
    "%s のネットワークのコピーのボタンの名前に、ネットワークの名前を入れる",
    (language, name, ipAddress) => {
      const copy = DETAIL_MESSAGES[language].copy;

      expect(copy.networkName("shop_default")).toBe(name);
      expect(copy.ipAddress("shop_default")).toBe(ipAddress);
    },
  );

  it.each([
    ["ja", "DB_PASSWORD の値を表示", "DB_PASSWORD の値を隠す"],
    ["en", "Show the value of DB_PASSWORD", "Hide the value of DB_PASSWORD"],
  ] as const)("%s の環境変数のボタンの名前に、環境変数の名前を入れる", (language, show, hide) => {
    const env = DETAIL_MESSAGES[language].env;

    expect(env.showLabel("DB_PASSWORD")).toBe(show);
    expect(env.hideLabel("DB_PASSWORD")).toBe(hide);
  });

  it.each([
    ["ja", "ボリューム shop_data の名前をコピー"],
    ["en", "Copy the name of volume shop_data"],
  ] as const)(
    "%s のボリュームのコピーのボタンの名前に、ボリュームの名前を入れる",
    (language, expected) => {
      expect(DETAIL_MESSAGES[language].copy.volumeName("shop_data")).toBe(expected);
    },
  );

  it.each([
    ["ja", "コンテナ web-1 の詳細を読み込めませんでした。"],
    ["en", "Couldn't load the details of container web-1. "],
  ] as const)("%s の読み込みの失敗の文は、コンテナの名前と原因を出す", (language, head) => {
    const text = DETAIL_MESSAGES[language].loadFailed("web-1", {
      kind: "expected",
      code: "engineRejected",
      engineMessage: "No such container: web-1",
    });

    expect(text.startsWith(head)).toBe(true);
    expect(text).toContain("No such container: web-1");
  });
});
