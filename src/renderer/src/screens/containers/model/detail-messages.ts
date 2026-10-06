import type { ContainerDetail, PublishedPort } from "../../../../../shared/containers";
import type { Language } from "../../../../../shared/language";
import type { Failure } from "../../../../../shared/result";
import { FAILURE_CAUSES } from "../../../messages/failure";

/** 詳細の文（docs/spec/containers.md の「詳細」）。 */
export type DetailMessages = {
  /** 行の ［詳細］ の名前。 */
  open: string;
  close: string;
  /** 重ねた詳細の ［拡大］ と、広げた詳細の ［縮小］ の名前。 */
  expand: string;
  shrink: string;
  /** 項目の名前。 */
  itemNames: {
    id: string;
    name: string;
    image: string;
    state: string;
    command: string;
    createdAt: string;
    startedAt: string;
    ports: string;
    mounts: string;
    networks: string;
    restartPolicy: string;
    env: string;
    imageEnv: string;
    labels: string;
  };
  /** 環境変数の ［表示］ と ［隠す］ の文と、読み上げに使うボタンの名前（docs/spec/containers.md の「環境変数は既定で隠す」）。 */
  env: {
    show: string;
    hide: string;
    showLabel: (key: string) => string;
    hideLabel: (key: string) => string;
  };
  /** コピーのボタンの名前と、コピーした後にボタンの場所に出す文（docs/spec/common.md の「利用者がコピーして使いたい値」）。 */
  copy: {
    id: string;
    name: string;
    imageName: string;
    imageId: string;
    volumeName: (volume: string) => string;
    networkName: (network: string) => string;
    ipAddress: (network: string) => string;
    copied: string;
    failed: string;
  };
  loadFailed: (name: string, failure: Failure) => string;
  restartPolicy: (policy: ContainerDetail["restartPolicy"]) => string;
};

/** 伏せた環境変数の値（docs/spec/containers.md の「環境変数は既定で隠す」）。 */
export const MASKED_ENV_VALUE = "●●●●●●●●";

/** 引数をシェルの書き方で囲まずに出せる文字だけでできているか。 */
const SHELL_SAFE_ARGUMENT = /^[A-Za-z0-9_@%+=:,./-]+$/;

/** コマンドを、空白で区切った 1 行にする。空白や記号を含む引数は、シェルと同じく ' で囲む。 */
export function commandTextOf(command: string[]): string {
  return command
    .map((argument) =>
      SHELL_SAFE_ARGUMENT.test(argument) ? argument : `'${argument.replaceAll("'", `'\\''`)}'`,
    )
    .join(" ");
}

/** 詳細の時刻（docs/spec/common.md の「表記」の「詳細とログの時刻」）。どの言語でも、ローカルの時刻を同じ形で出す。 */
export function dateTimeTextOf(time: number): string {
  const date = new Date(time);
  const twoDigitsOf = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${twoDigitsOf(date.getMonth() + 1)}-${twoDigitsOf(date.getDate())} ` +
    `${twoDigitsOf(date.getHours())}:${twoDigitsOf(date.getMinutes())}:${twoDigitsOf(date.getSeconds())}`
  );
}

/** 詳細のポートの 1 行。一覧の列と違い、プロトコルも出す。 */
export function portTextOf(port: PublishedPort): string {
  return `${port.publicPort} → ${port.privatePort}/${port.protocol}`;
}

/** マウントの 1 行。マウント元の無い tmpfs は、マウント元の代わりにマウントの種類を出す。 */
export function mountTextOf(mount: ContainerDetail["mounts"][number]): string {
  return `${mount.source === "" ? mount.mountType : mount.source} → ${mount.destination}`;
}

export const DETAIL_MESSAGES: Record<Language, DetailMessages> = {
  ja: {
    open: "詳細",
    close: "閉じる",
    expand: "拡大",
    shrink: "縮小",
    itemNames: {
      id: "コンテナ ID",
      name: "名前",
      image: "イメージ",
      state: "状態",
      command: "コマンド",
      createdAt: "作成した日時",
      startedAt: "起動した日時",
      ports: "ポート",
      mounts: "マウント",
      networks: "ネットワーク",
      restartPolicy: "再起動の設定",
      env: "環境変数",
      imageEnv: "イメージの環境変数",
      labels: "ラベル",
    },
    env: {
      show: "表示",
      hide: "隠す",
      showLabel: (key) => `${key} の値を表示`,
      hideLabel: (key) => `${key} の値を隠す`,
    },
    copy: {
      id: "コンテナ ID をコピー",
      name: "名前をコピー",
      imageName: "イメージの名前をコピー",
      imageId: "イメージ ID をコピー",
      volumeName: (volume) => `ボリューム ${volume} の名前をコピー`,
      networkName: (network) => `ネットワーク ${network} の名前をコピー`,
      ipAddress: (network) => `ネットワーク ${network} の IP アドレスをコピー`,
      copied: "コピーしました",
      failed: "コピーできませんでした",
    },
    loadFailed: (name, failure) =>
      `コンテナ ${name} の詳細を読み込めませんでした。${FAILURE_CAUSES.ja(failure)}`,
    restartPolicy: ({ name, maximumRetryCount }) => {
      if (name !== "on-failure") {
        return name;
      }
      return maximumRetryCount === 0
        ? "on-failure（回数の上限なし）"
        : `on-failure（最大 ${maximumRetryCount} 回）`;
    },
  },
  en: {
    open: "Details",
    close: "Close",
    expand: "Expand",
    shrink: "Shrink",
    itemNames: {
      id: "Container ID",
      name: "Name",
      image: "Image",
      state: "State",
      command: "Command",
      createdAt: "Created",
      startedAt: "Started",
      ports: "Ports",
      mounts: "Mounts",
      networks: "Networks",
      restartPolicy: "Restart policy",
      env: "Environment",
      imageEnv: "Image environment",
      labels: "Labels",
    },
    env: {
      show: "Show",
      hide: "Hide",
      showLabel: (key) => `Show the value of ${key}`,
      hideLabel: (key) => `Hide the value of ${key}`,
    },
    copy: {
      id: "Copy container ID",
      name: "Copy name",
      imageName: "Copy image name",
      imageId: "Copy image ID",
      volumeName: (volume) => `Copy the name of volume ${volume}`,
      networkName: (network) => `Copy the name of network ${network}`,
      ipAddress: (network) => `Copy the IP address on network ${network}`,
      copied: "Copied",
      failed: "Couldn't copy",
    },
    loadFailed: (name, failure) =>
      `Couldn't load the details of container ${name}. ${FAILURE_CAUSES.en(failure)}`,
    restartPolicy: ({ name, maximumRetryCount }) => {
      if (name !== "on-failure") {
        return name;
      }
      return maximumRetryCount === 0
        ? "on-failure (no retry limit)"
        : `on-failure (up to ${maximumRetryCount} ${maximumRetryCount === 1 ? "retry" : "retries"})`;
    },
  },
};
