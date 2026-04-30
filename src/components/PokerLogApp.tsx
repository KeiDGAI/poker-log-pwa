"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Copy, Download, FileText, Plus, Save, Trash2, Undo2 } from "lucide-react";

type Screen = "list" | "detail" | "live" | "export";
type Street = "preflop" | "flop" | "turn" | "river";
type Result = "" | "Win" | "Lose" | "Chop" | "Folded" | "No Showdown";

type QuickAction = {
  id: string;
  position: string;
  action: string;
  size?: string;
  street: Street;
  order: number;
  createdAt: string;
};

type HandNote = {
  id: string;
  createdAt: string;
  updatedAt: string;
  heroPosition: string;
  heroHand: string;
  exactHeroHand?: string;
  board: {
    flop: string;
    flopSuits?: string;
    turn: string;
    turnSuit?: string;
    river: string;
    riverSuit?: string;
    tags?: string[];
  };
  actions: Record<Street, QuickAction[]>;
  result: Result;
  amountMemo: string;
  handMemo: string;
};

type PokerSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  dateTime: string;
  place: string;
  stake: string;
  buyIn: string;
  rebuy: string;
  cashOut: string;
  rakeMemo: string;
  playerNotesText: string;
  sessionMemo: string;
  hands: HandNote[];
};

const STORAGE_KEY = "poker-log-fast-v1";
const positions = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const streets: Street[] = ["preflop", "flop", "turn", "river"];
const streetLabels: Record<Street, string> = { preflop: "PF", flop: "Flop", turn: "Turn", river: "River" };
const preflopActions = ["Fold", "Limp", "Open", "Call", "3bet", "4bet", "All-in"];
const postflopActions = ["Check", "Bet", "Call", "Raise", "All-in", "Fold"];
const betSizes = ["33%", "50%", "75%", "100%", "120%", "More"];
const boardTags = ["Wet", "Dry", "Two-tone", "Monotone", "Rainbow", "Paired", "Connected", "Flush draw"];
const quickHands = ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo", "AQs", "AQo", "AJs", "KQs", "QJs", "JTs", "T9s", "A5s"];
const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const boardTargets = ["flop", "turn", "river"] as const;
type BoardTarget = (typeof boardTargets)[number];
const suits = [
  { code: "h", label: "♥", className: "text-red-500" },
  { code: "d", label: "♦", className: "text-blue-500" },
  { code: "s", label: "♠", className: "text-slate-950" },
  { code: "c", label: "♣", className: "text-emerald-600" },
];

function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function nowLocalInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function blankActions(): Record<Street, QuickAction[]> {
  return { preflop: [], flop: [], turn: [], river: [] };
}

function newHand(): HandNote {
  const time = nowIso();
  return {
    id: uid(),
    createdAt: time,
    updatedAt: time,
    heroPosition: "",
    heroHand: "",
    exactHeroHand: "",
    board: { flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] },
    actions: blankActions(),
    result: "",
    amountMemo: "",
    handMemo: "",
  };
}

function newSession(): PokerSession {
  const time = nowIso();
  return {
    id: uid(),
    createdAt: time,
    updatedAt: time,
    dateTime: nowLocalInput(),
    place: "",
    stake: "",
    buyIn: "",
    rebuy: "",
    cashOut: "",
    rakeMemo: "",
    playerNotesText: "",
    sessionMemo: "",
    hands: [],
  };
}

function formatDate(value: string) {
  if (!value) return "";
  return value.replace("T", " ");
}

function actionsText(actions: QuickAction[]) {
  return actions.map((item) => `${item.position} ${item.action}${item.size ? ` ${item.size}` : ""}`).join(" / ");
}

function formatBoardCards(ranks = "", suits = "") {
  if (!ranks) return "";
  const cards = ranks.split("").map((rank, index) => `${rank}${suits[index] || ""}`);
  const incomplete = suits && suits.length !== ranks.length ? " (suit incomplete)" : "";
  return `${cards.join(suits ? " " : "")}${incomplete}`;
}

function formatBoard(hand: HandNote, street: BoardTarget) {
  if (street === "flop") return formatBoardCards(hand.board.flop, hand.board.flopSuits || "");
  if (street === "turn") return formatBoardCards(hand.board.turn, hand.board.turnSuit || "");
  return formatBoardCards(hand.board.river, hand.board.riverSuit || "");
}

export function buildExportText(session: PokerSession, mode: "all" | "summary" | "hands" = "all") {
  const sessionText = [
    "Session:",
    `Date: ${formatDate(session.dateTime)}`,
    `Place: ${session.place}`,
    `Stake: ${session.stake}`,
    `Buy-in: ${session.buyIn}`,
    `Rebuy/Add-on: ${session.rebuy}`,
    `Cash-out: ${session.cashOut}`,
    `Rake: ${session.rakeMemo}`,
    "",
    "Player Notes:",
    session.playerNotesText,
    "",
    "Session Memo:",
    session.sessionMemo,
  ].join("\n");

  const handsText = [
    "Hands:",
    ...session.hands.map((hand, index) => [
      "",
      `${index + 1})`,
      `Hero: ${hand.heroPosition || "-"} / ${hand.heroHand || "-"}${hand.exactHeroHand ? ` (${hand.exactHeroHand})` : ""}`,
      `PF: ${actionsText(hand.actions.preflop)}`,
      `Flop: ${formatBoard(hand, "flop")}${hand.board.flop ? " / " : ""}${actionsText(hand.actions.flop)}`,
      `Turn: ${formatBoard(hand, "turn")}${hand.board.turn ? " / " : ""}${actionsText(hand.actions.turn)}`,
      `River: ${formatBoard(hand, "river")}${hand.board.river ? " / " : ""}${actionsText(hand.actions.river)}`,
      `Board Tags: ${(hand.board.tags || []).join(" / ")}`,
      `Result: ${hand.result}`,
      `Amount: ${hand.amountMemo}`,
      `Memo: ${hand.handMemo}`,
    ].join("\n")),
  ].join("\n");

  if (mode === "summary") return sessionText;
  if (mode === "hands") return handsText;
  return `${sessionText}\n\n${handsText}`;
}

function downloadText(text: string, session: PokerSession) {
  const stamp = (session.dateTime || nowLocalInput()).replace(/[-:T]/g, "").slice(0, 12);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `poker-session-${stamp}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PokerLogApp() {
  const [sessions, setSessions] = useState<PokerSession[]>([]);
  const [screen, setScreen] = useState<Screen>("list");
  const [currentId, setCurrentId] = useState<string>("");
  const [editingHandId, setEditingHandId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let nextSessions: PokerSession[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) nextSessions = JSON.parse(stored);
    } catch {
      nextSessions = [];
    } finally {
      queueMicrotask(() => {
        setSessions(nextSessions);
        setLoaded(true);
      });
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [loaded, sessions]);

  const currentSession = sessions.find((session) => session.id === currentId);

  function upsertSession(next: PokerSession) {
    setSessions((current) => {
      const exists = current.some((session) => session.id === next.id);
      const updated = { ...next, updatedAt: nowIso() };
      return exists
        ? current.map((session) => (session.id === next.id ? updated : session))
        : [updated, ...current];
    });
    setCurrentId(next.id);
  }

  function startSession() {
    const session = newSession();
    upsertSession(session);
    setScreen("detail");
  }

  function deleteSession(id: string) {
    setSessions((current) => current.filter((session) => session.id !== id));
    if (currentId === id) {
      setCurrentId("");
      setScreen("list");
    }
  }

  function openLive(handId: string | null = null) {
    setEditingHandId(handId);
    setScreen("live");
  }

  function saveHand(hand: HandNote, makeNew: boolean) {
    if (!currentSession) return;
    const savedHand = { ...hand, updatedAt: nowIso() };
    const exists = currentSession.hands.some((item) => item.id === savedHand.id);
    const hands = exists
      ? currentSession.hands.map((item) => (item.id === savedHand.id ? savedHand : item))
      : [...currentSession.hands, savedHand];
    upsertSession({ ...currentSession, hands });
    setEditingHandId(null);
    setScreen(makeNew ? "live" : "detail");
  }

  function deleteHand(handId: string) {
    if (!currentSession) return;
    upsertSession({ ...currentSession, hands: currentSession.hands.filter((hand) => hand.id !== handId) });
  }

  if (!loaded) return <Shell><p className="p-6 text-slate-300">Loading...</p></Shell>;

  return (
    <Shell>
      {screen === "list" && (
        <SessionList
          sessions={sessions}
          onNew={startSession}
          onOpen={(id) => { setCurrentId(id); setScreen("detail"); }}
          onDelete={deleteSession}
          onExport={(id) => { setCurrentId(id); setScreen("export"); }}
        />
      )}
      {screen === "detail" && currentSession && (
        <SessionDetail
          session={currentSession}
          onBack={() => setScreen("list")}
          onChange={upsertSession}
          onLive={() => openLive(null)}
          onExport={() => setScreen("export")}
          onDelete={() => deleteSession(currentSession.id)}
          onEditHand={(id) => openLive(id)}
          onDeleteHand={deleteHand}
        />
      )}
      {screen === "live" && currentSession && (
        <LiveMode
          session={currentSession}
          hand={editingHandId ? currentSession.hands.find((item) => item.id === editingHandId) : undefined}
          onBack={() => setScreen("detail")}
          onSave={saveHand}
        />
      )}
      {screen === "export" && currentSession && (
        <ExportScreen session={currentSession} onBack={() => setScreen("detail")} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh bg-slate-950 text-slate-100"><div className="mx-auto min-h-dvh w-full max-w-md bg-slate-900 shadow-2xl">{children}</div></main>;
}

function Header({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

function SessionList({ sessions, onNew, onOpen, onDelete, onExport }: {
  sessions: PokerSession[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}) {
  return (
    <div>
      <Header title="Session List" subtitle="端末内に保存されます" action={<button onClick={onNew} className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950"><Plus size={16} className="inline" /> New</button>} />
      <section className="space-y-3 p-4">
        {sessions.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            まずは New Session から始めてください。プレイヤー登録なしで即メモできます。
          </div>
        )}
        {sessions.map((session) => (
          <article key={session.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <button onClick={() => onOpen(session.id)} className="block w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{formatDate(session.dateTime) || "日時なし"}</p>
                  <p className="text-sm text-slate-300">{session.place || "場所未入力"} / {session.stake || "ステーク未入力"}</p>
                </div>
                <span className="rounded bg-slate-700 px-2 py-1 text-xs font-bold">{session.hands.length} hands</span>
              </div>
              {(session.cashOut || session.buyIn) && <p className="mt-2 text-sm text-emerald-300">Buy-in {session.buyIn || "-"} / Cash-out {session.cashOut || "-"}</p>}
            </button>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => onOpen(session.id)} className="tap-btn bg-slate-700">Open</button>
              <button onClick={() => onExport(session.id)} className="tap-btn bg-slate-700">Export</button>
              <button onClick={() => onDelete(session.id)} className="tap-btn bg-red-950 text-red-200"><Trash2 size={16} /> Delete</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function SessionDetail({ session, onBack, onChange, onLive, onExport, onDelete, onEditHand, onDeleteHand }: {
  session: PokerSession;
  onBack: () => void;
  onChange: (session: PokerSession) => void;
  onLive: () => void;
  onExport: () => void;
  onDelete: () => void;
  onEditHand: (id: string) => void;
  onDeleteHand: (id: string) => void;
}) {
  const update = (patch: Partial<PokerSession>) => onChange({ ...session, ...patch });
  return (
    <div className="pb-28">
      <Header title="Session Detail" subtitle={`${session.hands.length} hands`} action={<button onClick={onBack} className="tap-small bg-slate-800">List</button>} />
      <section className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date / Time"><input className="fast-input" type="datetime-local" value={session.dateTime} onChange={(event) => update({ dateTime: event.target.value })} /></Field>
          <Field label="Stake"><input className="fast-input" value={session.stake} onChange={(event) => update({ stake: event.target.value })} placeholder="1-3" /></Field>
        </div>
        <Field label="Place / Store"><input className="fast-input" value={session.place} onChange={(event) => update({ place: event.target.value })} placeholder="渋谷 / Paradise City" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Buy-in"><input className="fast-input" value={session.buyIn} onChange={(event) => update({ buyIn: event.target.value })} /></Field>
          <Field label="Rebuy"><input className="fast-input" value={session.rebuy} onChange={(event) => update({ rebuy: event.target.value })} /></Field>
          <Field label="Cash-out"><input className="fast-input" value={session.cashOut} onChange={(event) => update({ cashOut: event.target.value })} /></Field>
        </div>
        <Field label="Rake memo"><input className="fast-input" value={session.rakeMemo} onChange={(event) => update({ rakeMemo: event.target.value })} placeholder="10% capあり" /></Field>
        <Field label="Player notes for this session"><textarea className="fast-textarea min-h-28" value={session.playerNotesText} onChange={(event) => update({ playerNotesText: event.target.value })} placeholder={"BTN: コール多め\nBB: 3bet少なめ"} /></Field>
        <Field label="Session memo"><textarea className="fast-textarea min-h-24" value={session.sessionMemo} onChange={(event) => update({ sessionMemo: event.target.value })} /></Field>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onLive} className="tap-primary col-span-2"><Plus size={18} /> Start Live Mode</button>
          <button onClick={onExport} className="tap-btn bg-slate-700"><FileText size={18} /> Export</button>
          <button onClick={onDelete} className="tap-btn bg-red-950 text-red-200"><Trash2 size={18} /> Delete</button>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-black text-slate-300">Hands</h2>
          <div className="space-y-2">
            {session.hands.map((hand, index) => (
              <article key={hand.id} className="rounded-lg bg-slate-800 p-3">
                <button onClick={() => onEditHand(hand.id)} className="block w-full text-left">
                  <div className="flex justify-between gap-2">
                    <p className="font-black">{index + 1}) {hand.heroPosition || "-"} / {hand.heroHand || "-"}</p>
                    <p className="text-sm font-bold text-emerald-300">{hand.result || "-"}</p>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-300">PF: {actionsText(hand.actions.preflop)}</p>
                  <p className="truncate text-sm text-slate-400">Board: {[formatBoard(hand, "flop"), formatBoard(hand, "turn"), formatBoard(hand, "river")].filter(Boolean).join(" / ") || "-"}</p>
                </button>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => onEditHand(hand.id)} className="tap-small bg-slate-700">Edit</button>
                  <button onClick={() => onDeleteHand(hand.id)} className="tap-small bg-red-950 text-red-200">Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function LiveMode({ session, hand, onBack, onSave }: {
  session: PokerSession;
  hand?: HandNote;
  onBack: () => void;
  onSave: (hand: HandNote, makeNew: boolean) => void;
}) {
  const [draft, setDraft] = useState<HandNote>(() => hand ? structuredClone(hand) : newHand());
  const [activeStreet, setActiveStreet] = useState<Street>("preflop");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [rankOne, setRankOne] = useState("");
  const [rankTwo, setRankTwo] = useState("");
  const [exactMode, setExactMode] = useState(false);
  const [exactCardRank, setExactCardRank] = useState("");
  const [boardTarget, setBoardTarget] = useState<BoardTarget>("flop");
  const [selectedSize, setSelectedSize] = useState("");

  useEffect(() => {
    setDraft(hand ? structuredClone(hand) : newHand());
    setActiveStreet("preflop");
    setSelectedPosition("");
  }, [hand]);

  const actions = activeStreet === "preflop" ? preflopActions : postflopActions;

  function patch(patch: Partial<HandNote>) {
    setDraft((current) => ({ ...current, ...patch, updatedAt: nowIso() }));
  }

  function patchBoard(board: Partial<HandNote["board"]>) {
    setDraft((current) => ({ ...current, board: { ...current.board, ...board }, updatedAt: nowIso() }));
  }

  function appendAction(action: string) {
    if (!selectedPosition) return;
    setDraft((current) => {
      const nextAction: QuickAction = {
        id: uid(),
        position: selectedPosition,
        action,
        size: activeStreet !== "preflop" && (action === "Bet" || action === "Raise") ? selectedSize : "",
        street: activeStreet,
        order: current.actions[activeStreet].length + 1,
        createdAt: nowIso(),
      };
      return {
        ...current,
        updatedAt: nowIso(),
        actions: { ...current.actions, [activeStreet]: [...current.actions[activeStreet], nextAction] },
      };
    });
  }

  function undoAction() {
    setDraft((current) => ({ ...current, actions: { ...current.actions, [activeStreet]: current.actions[activeStreet].slice(0, -1) } }));
  }

  function clearStreet() {
    setDraft((current) => ({ ...current, actions: { ...current.actions, [activeStreet]: [] } }));
  }

  function chooseRankOne(rank: string) {
    setRankOne(rank);
    setRankTwo("");
  }

  function chooseRankTwo(rank: string) {
    if (!rankOne) {
      setRankOne(rank);
      return;
    }
    setRankTwo(rank);
    if (rankOne === rank) patch({ heroHand: `${rank}${rank}`, exactHeroHand: "" });
  }

  function finishCombo(suffix: "s" | "o") {
    if (!rankOne || !rankTwo) return;
    patch({ heroHand: `${rankOne}${rankTwo}${suffix}`, exactHeroHand: "" });
  }

  function clearHeroHand() {
    patch({ heroHand: "", exactHeroHand: "" });
    setRankOne("");
    setRankTwo("");
    setExactCardRank("");
  }

  function chooseExactSuit(suit: string) {
    if (!exactCardRank) return;
    const card = `${exactCardRank}${suit}`;
    const existing = (draft.exactHeroHand || "").trim().split(/\s+/).filter(Boolean);
    const next = [...existing.slice(-1), card].slice(-2);
    patch({ exactHeroHand: next.join(" "), heroHand: next.join("") });
    setExactCardRank("");
  }

  function appendBoardRank(rank: string) {
    setDraft((current) => {
      const currentValue = current.board[boardTarget] || "";
      const maxLength = boardTarget === "flop" ? 3 : 1;
      if (currentValue.length >= maxLength) return current;
      return {
        ...current,
        updatedAt: nowIso(),
        board: { ...current.board, [boardTarget]: `${currentValue}${rank}` },
      };
    });
  }

  function appendBoardSuit(suit: string) {
    setDraft((current) => {
      if (boardTarget === "flop") {
        const currentValue = current.board.flopSuits || "";
        if (currentValue.length >= 3) return current;
        return { ...current, updatedAt: nowIso(), board: { ...current.board, flopSuits: `${currentValue}${suit}` } };
      }
      const key = boardTarget === "turn" ? "turnSuit" : "riverSuit";
      return { ...current, updatedAt: nowIso(), board: { ...current.board, [key]: suit } };
    });
  }

  function backspaceBoard() {
    setDraft((current) => ({
      ...current,
      updatedAt: nowIso(),
      board: { ...current.board, [boardTarget]: current.board[boardTarget].slice(0, -1) },
    }));
  }

  function clearBoard(target?: BoardTarget) {
    if (target) {
      if (target === "flop") patchBoard({ flop: "", flopSuits: "" });
      if (target === "turn") patchBoard({ turn: "", turnSuit: "" });
      if (target === "river") patchBoard({ river: "", riverSuit: "" });
      return;
    }
    patchBoard({ flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] });
  }

  function backspaceSuit() {
    setDraft((current) => {
      if (boardTarget === "flop") {
        return { ...current, updatedAt: nowIso(), board: { ...current.board, flopSuits: (current.board.flopSuits || "").slice(0, -1) } };
      }
      const key = boardTarget === "turn" ? "turnSuit" : "riverSuit";
      return { ...current, updatedAt: nowIso(), board: { ...current.board, [key]: "" } };
    });
  }

  function clearFlopSuits() {
    patchBoard({ flopSuits: "" });
  }

  function toggleBoardTag(tag: string) {
    setDraft((current) => {
      const tags = current.board.tags || [];
      const nextTags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
      return { ...current, updatedAt: nowIso(), board: { ...current.board, tags: nextTags } };
    });
  }

  function save(makeNew: boolean) {
    onSave(draft, makeNew);
    if (makeNew) setDraft(newHand());
  }

  return (
    <div className="pb-28">
      <Header title="Live Mode" subtitle={`${formatDate(session.dateTime)} / ${session.place || "No place"}`} action={<button onClick={onBack} className="tap-small bg-slate-800">Session</button>} />
      <section className="space-y-4 p-4">
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3">
          <p className="mb-2 text-xs font-black uppercase text-emerald-300">Hero Position</p>
          <ButtonGrid items={positions} selected={draft.heroPosition} onPick={(value) => patch({ heroPosition: value })} />
        </div>

        <div className="rounded-lg bg-slate-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-300">Hero Hand</p>
            <p className="text-lg font-black text-emerald-300">{draft.heroHand || "-"}</p>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <button onClick={clearHeroHand} className="tap-small bg-red-950 text-red-200">Clear Hero Hand</button>
            <button onClick={() => { setRankOne(""); setRankTwo(""); }} className="tap-small bg-slate-700">Re-select</button>
            <button onClick={() => setExactMode((value) => !value)} className="tap-small bg-slate-700">Edit Exact</button>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
            <p className="mb-2 text-xs font-black uppercase text-slate-400">Rank 1 {rankOne && <span className="text-emerald-300">/ {rankOne}</span>}</p>
            <div className="grid grid-cols-7 gap-2">
              {ranks.map((rank) => <button key={`r1-${rank}`} onClick={() => chooseRankOne(rank)} className={`tap-chip ${rankOne === rank ? "bg-emerald-500 text-slate-950" : ""}`}>{rank}</button>)}
            </div>
            <p className="mb-2 mt-3 text-xs font-black uppercase text-slate-400">Rank 2 {rankTwo && <span className="text-emerald-300">/ {rankTwo}</span>}</p>
            <div className="grid grid-cols-7 gap-2">
              {ranks.map((rank) => <button key={`r2-${rank}`} onClick={() => chooseRankTwo(rank)} className={`tap-chip ${rankTwo === rank ? "bg-emerald-500 text-slate-950" : ""}`}>{rank}</button>)}
            </div>
            {rankOne && rankTwo && rankOne !== rankTwo && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => finishCombo("s")} className="tap-btn bg-emerald-600 text-slate-950">suited = {rankOne}{rankTwo}s</button>
                <button onClick={() => finishCombo("o")} className="tap-btn bg-slate-700">offsuit = {rankOne}{rankTwo}o</button>
              </div>
            )}
          </div>
          <p className="mb-2 mt-3 text-xs font-black uppercase text-slate-400">Quick buttons</p>
          <div className="grid grid-cols-5 gap-2">
            {quickHands.map((item) => <button key={item} onClick={() => { patch({ heroHand: item, exactHeroHand: "" }); setRankOne(""); setRankTwo(""); }} className="tap-chip">{item}</button>)}
          </div>
          {exactMode && (
            <div className="mt-3 rounded-md bg-slate-900 p-3">
              <p className="mb-2 text-sm font-bold">Exact: {draft.exactHeroHand || "-"}</p>
              <div className="grid grid-cols-7 gap-2">
                {ranks.map((rank) => <button key={rank} onClick={() => setExactCardRank(rank)} className={`tap-chip ${exactCardRank === rank ? "bg-amber-300 text-slate-950" : ""}`}>{rank}</button>)}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {suits.map((suit) => <button key={suit.code} onClick={() => chooseExactSuit(suit.code)} className={`tap-btn bg-white ${suit.className}`}>{suit.label}</button>)}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-slate-800 p-3">
          <p className="mb-2 text-xs font-black uppercase text-slate-300">Board</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {boardTargets.map((target) => (
              <button key={target} onClick={() => setBoardTarget(target)} className={`tap-btn ${boardTarget === target ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>
                {target === "flop" ? "Flop" : target === "turn" ? "Turn" : "River"} {formatBoard(draft, target) || ""}
              </button>
            ))}
          </div>
          <div className="mb-3 grid grid-cols-7 gap-2">
            {ranks.map((rank) => <button key={`board-${rank}`} onClick={() => appendBoardRank(rank)} className="tap-chip">{rank}</button>)}
          </div>
          <div className="mb-3 rounded-md border border-slate-700 bg-slate-900 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-slate-400">
                {boardTarget === "flop" ? "Flop suit pattern" : `${boardTarget} suit`}
                <span className="ml-2 text-emerald-300">
                  {boardTarget === "flop" ? draft.board.flopSuits || "-" : boardTarget === "turn" ? draft.board.turnSuit || "-" : draft.board.riverSuit || "-"}
                </span>
              </p>
              {boardTarget === "flop" && draft.board.flopSuits && draft.board.flopSuits.length !== draft.board.flop.length && <span className="text-xs font-bold text-amber-300">suit incomplete</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["s", "h", "d", "c"].map((suit) => <button key={`board-suit-${suit}`} onClick={() => appendBoardSuit(suit)} className="tap-btn bg-slate-700">{suit}</button>)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={backspaceSuit} className="tap-small bg-slate-700">Backspace suit</button>
              <button onClick={clearFlopSuits} className="tap-small bg-red-950 text-red-200">Clear Flop Suits</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="fast-input" value={draft.board.flop} onChange={(event) => patchBoard({ flop: event.target.value })} placeholder="Flop 986" />
            <input className="fast-input" value={draft.board.turn} onChange={(event) => patchBoard({ turn: event.target.value })} placeholder="Turn A" />
            <input className="fast-input" value={draft.board.river} onChange={(event) => patchBoard({ river: event.target.value })} placeholder="River 2" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button onClick={backspaceBoard} className="tap-small bg-slate-700">Delete last</button>
            <button onClick={() => clearBoard(boardTarget)} className="tap-small bg-red-950 text-red-200">Clear {boardTarget}</button>
            <button onClick={() => clearBoard()} className="tap-small bg-red-950 text-red-200">Clear Board</button>
          </div>
          <p className="mb-2 mt-3 text-xs font-black uppercase text-slate-300">Board texture</p>
          <div className="grid grid-cols-4 gap-2">
            {boardTags.map((tag) => (
              <button key={tag} onClick={() => toggleBoardTag(tag)} className={`tap-small ${(draft.board.tags || []).includes(tag) ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>{tag}</button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="grid grid-cols-4 gap-2">
            {streets.map((street) => <button key={street} onClick={() => setActiveStreet(street)} className={`tap-btn ${activeStreet === street ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>{streetLabels[street]}</button>)}
          </div>
          <div className="mt-3 rounded-md bg-slate-950 p-3">
            <p className="text-sm font-black text-emerald-300">{streetLabels[activeStreet]}: {actionsText(draft.actions[activeStreet]) || "-"}</p>
          </div>
          <p className="mb-2 mt-3 text-xs font-black uppercase text-slate-300">Position</p>
          <ButtonGrid items={positions} selected={selectedPosition} onPick={setSelectedPosition} />
          <p className="mb-2 mt-3 text-xs font-black uppercase text-slate-300">Action</p>
          {activeStreet !== "preflop" && (
            <div className="mb-3 rounded-md border border-slate-700 bg-slate-900 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase text-slate-400">Bet / Raise size</p>
                <button onClick={() => setSelectedSize("")} className="text-xs font-bold text-slate-400">No size</button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {betSizes.map((size) => <button key={size} onClick={() => setSelectedSize(size)} className={`tap-small ${selectedSize === size ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>{size}</button>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {actions.map((action) => <button key={action} onClick={() => appendAction(action)} className="tap-btn bg-slate-700">{action}</button>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={undoAction} className="tap-btn bg-slate-700"><Undo2 size={18} /> Undo last</button>
            <button onClick={clearStreet} className="tap-btn bg-red-950 text-red-200">Clear street</button>
          </div>
        </div>

        <div className="rounded-lg bg-slate-800 p-3">
          <p className="mb-2 text-xs font-black uppercase text-slate-300">Result</p>
          <ButtonGrid items={["Win", "Lose", "Chop", "Folded", "No Showdown"]} selected={draft.result} onPick={(value) => patch({ result: value as Result })} />
          <input className="fast-input mt-3" value={draft.amountMemo} onChange={(event) => patch({ amountMemo: event.target.value })} placeholder="+12000 / -8000 / small win" />
          <textarea className="fast-textarea mt-3 min-h-24" value={draft.handMemo} onChange={(event) => patch({ handMemo: event.target.value })} placeholder="Hand memo" />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-md grid-cols-2 gap-2 border-t border-slate-700 bg-slate-900 p-3">
          <button onClick={() => save(false)} className="tap-btn bg-slate-700"><Save size={18} /> Save Hand</button>
          <button onClick={() => save(true)} className="tap-primary"><Save size={18} /> Save & New</button>
        </div>
      </section>
    </div>
  );
}

function ExportScreen({ session, onBack }: { session: PokerSession; onBack: () => void }) {
  const [mode, setMode] = useState<"all" | "summary" | "hands">("all");
  const [copied, setCopied] = useState("");
  const text = useMemo(() => buildExportText(session, mode), [session, mode]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1200);
  }

  return (
    <div className="pb-6">
      <Header title="Export" subtitle={copied || "AIに貼り付けやすいテキスト"} action={<button onClick={onBack} className="tap-small bg-slate-800">Session</button>} />
      <section className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setMode("all")} className={`tap-btn ${mode === "all" ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>All</button>
          <button onClick={() => setMode("summary")} className={`tap-btn ${mode === "summary" ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>Summary</button>
          <button onClick={() => setMode("hands")} className={`tap-btn ${mode === "hands" ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>Hands</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => copy(text, "Copied")} className="tap-primary"><Copy size={18} /> Copy All</button>
          <button onClick={() => downloadText(text, session)} className="tap-btn bg-slate-700"><Download size={18} /> Download .txt</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => copy(buildExportText(session, "summary"), "Summary copied")} className="tap-small bg-slate-700">Copy Summary</button>
          <button onClick={() => copy(buildExportText(session, "hands"), "Hands copied")} className="tap-small bg-slate-700">Copy Hands</button>
        </div>
        <textarea readOnly className="h-[60dvh] w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-100 outline-none" value={text} />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-400">{label}</span>{children}</label>;
}

function ButtonGrid({ items, selected, onPick }: { items: string[]; selected: string; onPick: (value: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((item) => (
        <button key={item} onClick={() => onPick(item)} className={`tap-btn ${selected === item ? "bg-emerald-500 text-slate-950" : "bg-slate-700"}`}>{item}</button>
      ))}
    </div>
  );
}
