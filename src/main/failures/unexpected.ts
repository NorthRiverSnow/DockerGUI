import type { Result } from "../../shared/result";

/** 受け止めた例外を、想定していない失敗の値に直す（design-policy.md の原則 9）。 */
// TODO: ログの記録（src/main/log）を作るステップで、error のスタックトレースをログに書く（design-policy.md の原則 9）
export function unexpectedResultOf(_error: unknown): Result<never> {
  return { ok: false, failure: { kind: "unexpected" } };
}
