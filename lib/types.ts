export type Match = {
  id: string;
  name: string;
  match_date: string | null;
  num_cards: number;
};

export type CardScore = {
  id: string;
  entry_id: string;
  card_number: number;
  score: number;
  first_miss: number | null;
  notes: string | null;
};

export type Entry = {
  id: string;
  match_id: string;
  entry_number: number;
  name: string;
  class: string | null;
  card_scores: CardScore[];
};

export const totalOf = (e: Entry) =>
  e.card_scores.reduce((sum, c) => sum + c.score, 0);

export const cardOf = (e: Entry, n: number) =>
  e.card_scores.find((c) => c.card_number === n);
