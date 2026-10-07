import type { Language } from "../../../shared/language";
import type { Failure } from "../../../shared/result";

/** 失敗の原因の文（docs/spec/common.md の「失敗の見せ方」の「原因」）。状態バーと、一覧を出す画面で使う。 */
export const FAILURE_CAUSES: Record<Language, (failure: Failure) => string> = {
  ja: jaCauseOf,
  en: enCauseOf,
};

function jaCauseOf(failure: Failure): string {
  if (failure.kind === "unexpected") {
    return "原因が分かりません";
  }
  switch (failure.code) {
    case "engineRejected":
      return failure.engineMessage;
    case "engineUnreachable":
      return "応答がありません";
    case "apiVersionUnsupported":
      return "DockerGUI が対応していない Engine API の版です";
    case "engineTimedOut":
      return "時間内に応答がありません";
    case "engineNotFound":
      return "Docker のエンジンが見つかりません";
    case "engineStartFailed":
      return `${failure.command} が失敗しました: ${failure.stderr}`;
  }
}

function enCauseOf(failure: Failure): string {
  if (failure.kind === "unexpected") {
    return "unknown cause";
  }
  switch (failure.code) {
    case "engineRejected":
      return failure.engineMessage;
    case "engineUnreachable":
      return "no response";
    case "apiVersionUnsupported":
      return "the Engine API version is not supported by DockerGUI";
    case "engineTimedOut":
      return "the engine did not respond in time";
    case "engineNotFound":
      return "no Docker engine was found";
    case "engineStartFailed":
      return `${failure.command} failed: ${failure.stderr}`;
  }
}
