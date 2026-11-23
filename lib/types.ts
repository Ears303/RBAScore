export type Match = {
  id: string;
  name: string;
  match_date: string | null;
};

export type RbaClass = {
  id: string;
  match_id: string;
  name: string;
  /** how many cards are shot in this class */
  num_cards: number;
  sort_order: number;
};

/** e.g. "2 Gun Agg": the sum of the listed classes. */
export type Aggregate = {
  id: string;
  match_id: string;
  name: string;
  class_ids: string[];
};

export type CardScore = {
  id: string;
  entry_id: string;
  class_id: string;
  card_number: number;
  /** shot values in order: 0 to 10, or 10.01 for an X */
  shots: number[];
  /** card total, max 250.25 (the decimals are the X count) */
  score: number;
  first_miss: number | null;
  notes: string | null;
};

export type Entry = {
  id: string;
  match_id: string;
  entry_number: number;
  name: string;
  card_scores: CardScore[];
};

export type MatchData = {
  classes: RbaClass[];
  aggregates: Aggregate[];
  entries: Entry[];
};

export const emptyMatchData = (): MatchData => ({ classes: [], aggregates: [], entries: [] });

const hundredths = (n: number) => Math.round(Number(n) * 100);

export const scoresIn = (e: Entry, classId: string) =>
  e.card_scores.filter((c) => c.class_id === classId);

export const hasClass = (e: Entry, classId: string) => scoresIn(e, classId).length > 0;

export const cardOf = (e: Entry, classId: string, n: number) =>
  e.card_scores.find((c) => c.class_id === classId && c.card_number === n);

/** Total for one class, summed in hundredths to avoid float drift. */
export const classTotal = (e: Entry, classId: string) =>
  scoresIn(e, classId).reduce((s, c) => s + hundredths(c.score), 0) / 100;

/** Total across several classes (an aggregate). */
export const totalOver = (e: Entry, classIds: string[]) =>
  classIds.reduce((s, id) => s + hundredths(classTotal(e, id)), 0) / 100;

/** A competitor is on a board once they have scores in every class it covers. */
export const onBoard = (e: Entry, classIds: string[]) =>
  classIds.length > 0 && classIds.every((id) => hasClass(e, id));

export const xCount = (shots: number[]) => shots.filter((v) => Number(v) > 10).length;
