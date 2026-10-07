import type { Language } from "../../../shared/language";

/** 経過した時間の文（docs/spec/common.md の「待たせるときの表示」）。状態バーと、待たせる処理がある画面で使う。 */
export const ELAPSED_TEXTS: Record<Language, (milliseconds: number) => string> = {
  ja: (milliseconds) => `経過 ${minutesAndSecondsOf(milliseconds)}`,
  en: (milliseconds) => `Elapsed ${minutesAndSecondsOf(milliseconds)}`,
};

/** 00:18 のように、分と秒を 2 桁ずつで返す。1 時間を超えても、分の桁を増やして表す。 */
function minutesAndSecondsOf(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
