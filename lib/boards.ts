import { fmt2 } from "./shots";
import {
  cardOf,
  classTotal,
  onBoard,
  totalOver,
  type Entry,
  type MatchData,
} from "./types";

/** One ranked list: a single class, or an aggregate (2 Gun, 3 Gun) that adds several classes. */
export type Board = { key: string; title: string; classIds: string[]; isAgg: boolean };
export type Row = { e: Entry; total: number; rank: string };
/** A column between the name and the score: a card on a class board, a class total on an aggregate. */
export type Col = { label: string; get: (e: Entry) => string };

/** Class boards first (in class order), then the aggregates with the smaller one first (2 Gun, then 3 Gun). */
export function makeBoards(data: MatchData): Board[] {
  return [
    ...data.classes.map((c) => ({ key: c.id, title: c.name, classIds: [c.id], isAgg: false })),
    ...data.aggregates
      .map((a) => ({ ...a, class_ids: a.class_ids.filter((id) => data.classes.some((c) => c.id === id)) }))
      .sort((a, b) => a.class_ids.length - b.class_ids.length)
      .map((a) => ({
      key: `agg:${a.id}`,
      title: a.name,
      classIds: a.class_ids,
      isAgg: true,
    })),
  ];
}

/** Ranked rows: highest first, ties share a rank and show "=". Only shooters with every class on the board. */
export function rankBoard(entries: Entry[], classIds: string[]): Row[] {
  const list = entries
    .filter((e) => onBoard(e, classIds))
    .map((e) => ({ e, total: totalOver(e, classIds) }))
    .sort((a, b) => b.total - a.total || a.e.entry_number - b.e.entry_number);
  return list.map((r) => ({
    ...r,
    rank: `${1 + list.filter((x) => x.total > r.total).length}${
      list.filter((x) => x.total === r.total).length > 1 ? "=" : ""
    }`,
  }));
}

export function colsFor(b: Board, data: MatchData): Col[] {
  if (b.isAgg) {
    return b.classIds.map((id) => ({
      label: data.classes.find((c) => c.id === id)?.name ?? "",
      get: (e: Entry) => fmt2(classTotal(e, id)),
    }));
  }
  const id = b.classIds[0];
  const n = data.classes.find((c) => c.id === id)?.num_cards ?? 0;
  return Array.from({ length: n }, (_, i) => ({
    label: `Card ${i + 1}`,
    get: (e: Entry) => {
      const c = cardOf(e, id, i + 1);
      return c ? fmt2(Number(c.score)) : "–";
    },
  }));
}

/** A card that scored 250 (all ten shots 10 or X); the decimals are its X count. */
export type Perfect = { id: string; name: string; className: string; card: number };

/** Every 250 card in the match, most recently saved first. */
export function perfectCards(data: MatchData): Perfect[] {
  const found: (Perfect & { when: string })[] = [];
  for (const e of data.entries) {
    for (const c of e.card_scores) {
      if (Number(c.score) < 250) continue;
      const cl = data.classes.find((x) => x.id === c.class_id);
      if (!cl) continue;
      found.push({ id: c.id, name: e.name, className: cl.name, card: c.card_number, when: c.updated_at ?? "" });
    }
  }
  return found.sort((a, b) => b.when.localeCompare(a.when));
}
