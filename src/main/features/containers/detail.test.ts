import { afterEach, describe, expect, it } from "vite-plus/test";
import { engineClientOf } from "../../engine-api/client";
import {
  startFakeEngineWith,
  unusedSocketPath,
  type FakeEngine,
  type FakeResponse,
} from "../../engine-api/fake-engine.test-helper";
import { socketAgentOf } from "../../os/agent";
import { containerDetailOf } from "./detail";

let engine: FakeEngine | undefined;

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

/** 詳細の画面に出す項目をすべて持つ、動作中のコンテナの詳細。overrides で項目を差し替える。 */
function inspectOf(overrides: Record<string, unknown> = {}) {
  return {
    Id: "a1",
    Name: "/web-1",
    Created: "2026-09-15T06:00:12.123456789Z",
    Path: "nginx",
    Args: ["-g", "daemon off;"],
    Image: "sha256:4f2a",
    State: {
      Status: "running",
      ExitCode: 0,
      Error: "",
      OOMKilled: false,
      Health: { Status: "healthy" },
      StartedAt: "2026-09-15T06:01:45.381898767Z",
      FinishedAt: "0001-01-01T00:00:00Z",
    },
    Config: {
      Image: "nginx:1.27",
      Env: ["NGINX_PORT=80", "OPTIONS=a=b", "EMPTY"],
      Labels: { "com.docker.compose.service": "web", "com.docker.compose.project": "shop" },
    },
    Mounts: [
      {
        Type: "volume",
        Name: "shop_data",
        Source: "/var/lib/docker/volumes/shop_data/_data",
        Destination: "/data",
      },
      { Type: "bind", Source: "/Users/me/html", Destination: "/usr/share/nginx/html" },
      { Type: "tmpfs", Source: "", Destination: "/tmp" },
    ],
    NetworkSettings: {
      Ports: {
        "443/tcp": [{ HostIp: "127.0.0.1", HostPort: "8443" }],
        "80/tcp": [
          { HostIp: "0.0.0.0", HostPort: "8080" },
          { HostIp: "::", HostPort: "8080" },
        ],
        "9000/tcp": null,
      },
      Networks: { shop_default: { IPAddress: "172.19.0.3" }, bridge: { IPAddress: "" } },
    },
    HostConfig: {
      RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 },
      Tmpfs: { "/run": "rw,noexec,nosuid,size=65536k" },
    },
    ...overrides,
  };
}

/**
 * イメージの詳細。NGINX_PORT は、コンテナと同じ名前と値の組。OPTIONS は、コンテナを作るときに別の値で上書きされた組。
 * PATH は、コンテナに無い組。
 */
const IMAGE_INSPECT = {
  Config: { Env: ["PATH=/usr/local/bin:/usr/bin", "NGINX_PORT=80", "OPTIONS=default"] },
};

/** イメージの要求には image を、それ以外の要求には inspect を返すエンジンの代わりに繋ぐクライアントを返す。 */
async function clientFor(
  inspect: unknown,
  image: FakeResponse = { status: 200, body: JSON.stringify(IMAGE_INSPECT) },
) {
  engine = await startFakeEngineWith((url) =>
    url.includes("/images/") ? image : { status: 200, body: JSON.stringify(inspect) },
  );
  return engineClientOf(socketAgentOf(engine.socketPath), "1.54");
}

describe("containerDetailOf", () => {
  it("コンテナの詳細を、詳細の画面に出す値にする", async () => {
    const client = await clientFor(inspectOf());

    expect(await containerDetailOf(client, "a1")).toEqual({
      ok: true,
      value: {
        id: "a1",
        name: "web-1",
        image: { name: "nginx:1.27", id: "sha256:4f2a" },
        state: { kind: "running", health: "healthy" },
        stateError: undefined,
        command: ["nginx", "-g", "daemon off;"],
        createdAt: Date.parse("2026-09-15T06:00:12.123456789Z"),
        startedAt: Date.parse("2026-09-15T06:01:45.381898767Z"),
        ports: [
          { publicPort: 8080, privatePort: 80, protocol: "tcp" },
          { publicPort: 8443, privatePort: 443, protocol: "tcp" },
        ],
        mounts: [
          { mountType: "volume", source: "shop_data", destination: "/data" },
          { mountType: "tmpfs", source: "", destination: "/run" },
          { mountType: "tmpfs", source: "", destination: "/tmp" },
          { mountType: "bind", source: "/Users/me/html", destination: "/usr/share/nginx/html" },
        ],
        networks: [
          { name: "bridge", ipAddress: "" },
          { name: "shop_default", ipAddress: "172.19.0.3" },
        ],
        restartPolicy: { name: "unless-stopped", maximumRetryCount: 0 },
        env: [
          { key: "OPTIONS", value: "a=b" },
          { key: "EMPTY", value: "" },
        ],
        imageEnv: [{ key: "NGINX_PORT", value: "80" }],
        labels: [
          { key: "com.docker.compose.project", value: "shop" },
          { key: "com.docker.compose.service", value: "web" },
        ],
      },
    });
  });

  it("再起動の設定が空文字なら、再起動の設定を no にする", async () => {
    const client = await clientFor(
      inspectOf({ HostConfig: { RestartPolicy: { Name: "", MaximumRetryCount: 0 } } }),
    );

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.restartPolicy).toEqual({ name: "no", maximumRetryCount: 0 });
  });

  it("on-failure の再起動の設定では、再試行の回数も返す", async () => {
    const client = await clientFor(
      inspectOf({ HostConfig: { RestartPolicy: { Name: "on-failure", MaximumRetryCount: 3 } } }),
    );

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.restartPolicy).toEqual({
      name: "on-failure",
      maximumRetryCount: 3,
    });
  });

  it("ホストのポートが空文字の公開は、外に公開していないので、ポートに入れない", async () => {
    const client = await clientFor(
      inspectOf({
        NetworkSettings: { Ports: { "80/tcp": [{ HostIp: "", HostPort: "" }] }, Networks: {} },
      }),
    );

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.ports).toEqual([]);
  });

  it("エンジンが記録した失敗の文があれば、stateError に入れる", async () => {
    const inspect = inspectOf();
    const client = await clientFor({
      ...inspect,
      State: {
        ...inspect.State,
        Status: "exited",
        ExitCode: 128,
        Error: "port is already allocated",
      },
    });

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.stateError).toBe("port is already allocated");
  });

  it("作った時刻・環境変数・ラベル・ポート・ネットワークが null なら、時刻を undefined に、残りを空の一覧にする", async () => {
    const client = await clientFor(
      inspectOf({
        Created: null,
        Config: { Image: "nginx:1.27", Env: null, Labels: null },
        NetworkSettings: { Ports: null, Networks: null },
      }),
    );

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value).toMatchObject({
      createdAt: undefined,
      env: [],
      labels: [],
      ports: [],
      networks: [],
    });
  });

  it("--tmpfs の tmpfs が無ければ（HostConfig.Tmpfs が null）、Mounts のマウントだけを返す", async () => {
    const client = await clientFor(
      inspectOf({
        Mounts: [{ Type: "bind", Source: "/Users/me/html", Destination: "/html" }],
        HostConfig: { RestartPolicy: { Name: "no", MaximumRetryCount: 0 }, Tmpfs: null },
      }),
    );

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.mounts).toEqual([
      { mountType: "bind", source: "/Users/me/html", destination: "/html" },
    ]);
  });

  it("イメージが無ければ、すべての環境変数を、作るときに指定したものとして返す", async () => {
    const client = await clientFor(inspectOf(), {
      status: 404,
      body: '{"message":"No such image: sha256:4f2a"}',
    });

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.env.map((entry) => entry.key)).toEqual([
      "NGINX_PORT",
      "OPTIONS",
      "EMPTY",
    ]);
    expect(detail.ok && detail.value.imageEnv).toEqual([]);
  });

  it("イメージの環境変数が null なら、すべての環境変数を、作るときに指定したものとして返す", async () => {
    const client = await clientFor(inspectOf(), {
      status: 200,
      body: JSON.stringify({ Config: { Env: null } }),
    });

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.env).toHaveLength(3);
    expect(detail.ok && detail.value.imageEnv).toEqual([]);
  });

  it("イメージの詳細に Config が無ければ、すべての環境変数を、作るときに指定したものとして返す", async () => {
    const client = await clientFor(inspectOf(), { status: 200, body: "{}" });

    const detail = await containerDetailOf(client, "a1");

    expect(detail.ok && detail.value.imageEnv).toEqual([]);
  });

  it("イメージの詳細が Engine API の文書に無い形なら、想定していない失敗を返す", async () => {
    const client = await clientFor(inspectOf(), {
      status: 200,
      body: JSON.stringify({ Config: { Env: "NGINX_PORT=80" } }),
    });

    expect(await containerDetailOf(client, "a1")).toEqual({
      ok: false,
      failure: { kind: "unexpected" },
    });
  });

  it("ID の / などを URL の中で使える文字に置き換えて、届いた ID のコンテナの詳細を要求し、続けてコンテナのイメージ ID でイメージの詳細を要求する", async () => {
    const client = await clientFor(inspectOf());

    await containerDetailOf(client, "a/1");

    expect(engine?.requestedUrls).toEqual([
      "/v1.54/containers/a%2F1/json",
      "/v1.54/images/sha256%3A4f2a/json",
    ]);
  });

  it("コンテナが無ければ、エンジンが返した文を engineRejected で返す", async () => {
    engine = await startFakeEngineWith(() => ({
      status: 404,
      body: '{"message":"No such container: gone"}',
    }));
    const client = engineClientOf(socketAgentOf(engine.socketPath), "1.54");

    expect(await containerDetailOf(client, "gone")).toEqual({
      ok: false,
      failure: {
        kind: "expected",
        code: "engineRejected",
        engineMessage: "No such container: gone",
      },
    });
  });

  it("エンジンに繋がらなければ、繋がらないことを返す", async () => {
    const client = engineClientOf(socketAgentOf(unusedSocketPath()), "1.54");

    expect(await containerDetailOf(client, "a1")).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineUnreachable" },
    });
  });
});
