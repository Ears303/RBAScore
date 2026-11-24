// Shot helpers. A card is 25 shots. Each shot is a whole number 0 to 10, or X which scores 10.01,
// so a perfect card is 25 x 10.01 = 250.25.

export const SHOTS = 25;
export const X_VALUE = 10.01;

/** "" -> null (empty), "X" -> 10.01, "0".."10" -> number, anything else -> NaN. */
export function shotValue(s: string): number | null {
  if (s === "") return null;
  if (s === "X") return X_VALUE;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : NaN;
}

/** Card score from shot strings, summed in hundredths to avoid float drift. */
export function cardScore(shots: string[]): number {
  let hundredths = 0;
  for (const s of shots) {
    const v = shotValue(s);
    if (v !== null && !Number.isNaN(v)) hundredths += Math.round(v * 100);
  }
  return hundredths / 100;
}

export function shotLabel(v: number): string {
  return v > 10 ? "X" : String(v);
}

export function fmt2(n: number): string {
  return n.toFixed(2);
}

export type InputResult = {
  next: string[];
  /** index of the box that should have focus afterwards */
  focus: number;
  /** a lone "1" or "0" is waiting to see if another "0" follows (10, or 00 = X) */
  pending: boolean;
};

/**
 * Handles typing or pasting into shot box `i`. Works as a stream, so it behaves the same on
 * a desktop keyboard, a phone keyboard and a paste like "10 00 00 9 8".
 *  - digits 2 to 9 complete the shot and move on
 *  - "1" waits: a following "0" makes 10, any other key makes it 1 and moves on
 *  - "0" waits: a following "0" makes an X (00), any other key makes it 0 and moves on
 *  - the letter X still works as an X
 *  - space only confirms a waiting "1" or "0"
 */
export function applyInput(shots: string[], i: number, raw: string): InputResult {
  const s = raw
    .toUpperCase()
    .replace(/[,;\t\n\r]/g, " ")
    .replace(/[^0-9X ]/g, "");
  const next = [...shots];

  if (s === "") {
    next[i] = "";
    return { next, focus: i, pending: false };
  }

  let idx = i;
  let pending: "1" | "0" | null = null;
  const put = (v: string) => {
    if (idx < SHOTS) next[idx] = v;
  };
  const flush = () => {
    if (pending) {
      put(pending);
      idx++;
      pending = null;
    }
  };

  for (const ch of s) {
    if (idx >= SHOTS) {
      pending = null;
      break;
    }
    if (ch === " ") {
      flush();
      continue;
    }
    if (ch === "X") {
      flush();
      if (idx < SHOTS) {
        put("X");
        idx++;
      }
      continue;
    }
    // a digit
    if (pending === "1" && ch === "0") {
      put("10");
      idx++;
      pending = null;
      continue;
    }
    if (pending === "0" && ch === "0") {
      put("X");
      idx++;
      pending = null;
      continue;
    }
    flush();
    if (idx >= SHOTS) break;
    if (ch === "1" || ch === "0") {
      pending = ch;
    } else {
      put(ch);
      idx++;
    }
  }

  if (pending && idx < SHOTS) put(pending);
  return {
    next,
    focus: Math.min(idx, SHOTS - 1),
    pending: pending !== null && idx < SHOTS,
  };
}
