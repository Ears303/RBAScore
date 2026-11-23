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
  /** a lone "1" is waiting to see if a "0" follows (making 10) */
  pendingOne: boolean;
};

/**
 * Handles typing or pasting into shot box `i`. Works as a stream, so it behaves the same on
 * a desktop keyboard, a phone keyboard and a paste like "10 X X 9 8".
 *  - X, or a digit 0 and 2 to 9, completes the shot and moves on
 *  - "1" waits: a following "0" makes 10, any other key makes it 1 and moves on
 *  - space only confirms a waiting "1"
 */
export function applyInput(shots: string[], i: number, raw: string): InputResult {
  const s = raw
    .toUpperCase()
    .replace(/[,;\t\n\r]/g, " ")
    .replace(/[^0-9X ]/g, "");
  const next = [...shots];

  if (s === "") {
    next[i] = "";
    return { next, focus: i, pendingOne: false };
  }

  let idx = i;
  let pending = false;
  const put = (v: string) => {
    if (idx < SHOTS) next[idx] = v;
  };

  for (const ch of s) {
    if (idx >= SHOTS) {
      pending = false;
      break;
    }
    if (ch === " ") {
      if (pending) {
        put("1");
        idx++;
        pending = false;
      }
      continue;
    }
    if (ch === "X") {
      if (pending) {
        put("1");
        idx++;
        pending = false;
      }
      if (idx < SHOTS) {
        put("X");
        idx++;
      }
      continue;
    }
    // a digit
    if (pending) {
      if (ch === "0") {
        put("10");
        idx++;
        pending = false;
        continue;
      }
      put("1");
      idx++;
      pending = false;
      if (idx >= SHOTS) break;
    }
    if (ch === "1") {
      pending = true;
    } else {
      put(ch);
      idx++;
    }
  }

  if (pending && idx < SHOTS) put("1");
  return {
    next,
    focus: Math.min(idx, SHOTS - 1),
    pendingOne: pending && idx < SHOTS,
  };
}
