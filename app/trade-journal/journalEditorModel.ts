import type { TradeJournalRow } from "@/lib/tradeJournalDb";
import { parseOptionalNumberInput } from "@/lib/tradeJournalDb";

export type TradeJournalEditorState = {
  open: boolean;
  mode: "create" | "edit";
  id: string | null;
  title: string;
  notes: string;
  mint: string;
  tagsRaw: string;
  status: "open" | "closed";
  hasEdge: boolean;
  tokenSymbol: string;
  tokenName: string;
  timeframe: string;
  entryMcapUsd: string;
  exitMcapUsd: string;
  exitMcapsNote: string;
  profitUsd: string;
  profitPct: string;
  positionSizeUsd: string;
  entryPriceUsd: string;
  exitPriceUsd: string;
  thesis: string;
  narrative: string;
  entryJustification: string;
  plannedInvalidation: string;
  lessonsLearned: string;
};

export function emptyTradeJournalEditor(): TradeJournalEditorState {
  return {
    open: false,
    mode: "create",
    id: null,
    title: "",
    notes: "",
    mint: "",
    tagsRaw: "",
    status: "open",
    hasEdge: false,
    tokenSymbol: "",
    tokenName: "",
    timeframe: "",
    entryMcapUsd: "",
    exitMcapUsd: "",
    exitMcapsNote: "",
    profitUsd: "",
    profitPct: "",
    positionSizeUsd: "",
    entryPriceUsd: "",
    exitPriceUsd: "",
    thesis: "",
    narrative: "",
    entryJustification: "",
    plannedInvalidation: "",
    lessonsLearned: "",
  };
}

function nStr(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(v);
}

export function rowToEditor(row: TradeJournalRow): TradeJournalEditorState {
  return {
    open: true,
    mode: "edit",
    id: row.id,
    title: row.title,
    notes: row.notes,
    mint: row.mint ?? "",
    tagsRaw: row.tags.join(", "),
    status: row.status,
    hasEdge: row.has_edge,
    tokenSymbol: row.token_symbol ?? "",
    tokenName: row.token_name ?? "",
    timeframe: row.timeframe ?? "",
    entryMcapUsd: nStr(row.entry_mcap_usd),
    exitMcapUsd: nStr(row.exit_mcap_usd),
    exitMcapsNote: row.exit_mcaps_note ?? "",
    profitUsd: nStr(row.profit_usd),
    profitPct: nStr(row.profit_pct),
    positionSizeUsd: nStr(row.position_size_usd),
    entryPriceUsd: nStr(row.entry_price_usd),
    exitPriceUsd: nStr(row.exit_price_usd),
    thesis: row.thesis ?? "",
    narrative: row.narrative ?? "",
    entryJustification: row.entry_justification ?? "",
    plannedInvalidation: row.planned_invalidation ?? "",
    lessonsLearned: row.lessons_learned ?? "",
  };
}

export function editorToSaveBody(editor: TradeJournalEditorState, tags: string[]) {
  return {
    title: editor.title.trim(),
    notes: editor.notes,
    mint: editor.mint.trim() || null,
    tags,
    status: editor.status,
    hasEdge: editor.hasEdge,
    tokenSymbol: editor.tokenSymbol.trim() || null,
    tokenName: editor.tokenName.trim() || null,
    timeframe: editor.timeframe.trim() || null,
    entryMcapUsd: parseOptionalNumberInput(editor.entryMcapUsd),
    exitMcapUsd: parseOptionalNumberInput(editor.exitMcapUsd),
    exitMcapsNote: editor.exitMcapsNote.trim() || null,
    profitUsd: parseOptionalNumberInput(editor.profitUsd),
    profitPct: parseOptionalNumberInput(editor.profitPct),
    positionSizeUsd: parseOptionalNumberInput(editor.positionSizeUsd),
    entryPriceUsd: parseOptionalNumberInput(editor.entryPriceUsd),
    exitPriceUsd: parseOptionalNumberInput(editor.exitPriceUsd),
    thesis: editor.thesis.trim() || null,
    narrative: editor.narrative.trim() || null,
    entryJustification: editor.entryJustification.trim() || null,
    plannedInvalidation: editor.plannedInvalidation.trim() || null,
    lessonsLearned: editor.lessonsLearned.trim() || null,
  };
}
