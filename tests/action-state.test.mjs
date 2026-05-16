import assert from "node:assert/strict";
import test from "node:test";

const streets = ["preflop", "flop", "turn", "river"];

function blankActions() {
  return { preflop: [], flop: [], turn: [], river: [] };
}

function newHand() {
  return {
    id: "hand-1",
    heroPosition: "",
    heroHand: "",
    board: { flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] },
    actions: blankActions(),
    result: "",
    amountMemo: "",
    handMemo: "",
  };
}

function appendAction(hand, street, position, action, size = "") {
  return {
    ...hand,
    actions: {
      ...hand.actions,
      [street]: [
        ...hand.actions[street],
        { id: `${street}-${hand.actions[street].length + 1}`, street, position, action, size, order: hand.actions[street].length + 1 },
      ],
    },
  };
}

function selectHeroHand(rankOne, rankTwo, suitedness = "") {
  if (rankOne === rankTwo) return `${rankOne}${rankTwo}`;
  return `${rankOne}${rankTwo}${suitedness}`;
}

function appendBoardRank(board, target, rank) {
  const maxLength = target === "flop" ? 3 : 1;
  if (board[target].length >= maxLength) return board;
  return { ...board, [target]: `${board[target]}${rank}` };
}

function appendBoardSuit(board, target, suit) {
  if (target === "flop") {
    if (board.flopSuits.length >= 3) return board;
    return { ...board, flopSuits: `${board.flopSuits}${suit}` };
  }
  return { ...board, [target === "turn" ? "turnSuit" : "riverSuit"]: suit };
}

function clearBoard(board, target) {
  if (!target) return { flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] };
  if (target === "flop") return { ...board, flop: "", flopSuits: "" };
  if (target === "turn") return { ...board, turn: "", turnSuit: "" };
  return { ...board, river: "", riverSuit: "" };
}

function formatBoardCards(ranks = "", suits = "") {
  if (!ranks) return "";
  const cards = ranks.split("").map((rank, index) => `${rank}${suits[index] || ""}`);
  const incomplete = suits && suits.length !== ranks.length ? " (suit incomplete)" : "";
  return `${cards.join(suits ? " " : "")}${incomplete}`;
}

function formatBoard(hand, street) {
  if (street === "flop") return formatBoardCards(hand.board.flop, hand.board.flopSuits);
  if (street === "turn") return formatBoardCards(hand.board.turn, hand.board.turnSuit);
  return formatBoardCards(hand.board.river, hand.board.riverSuit);
}

function actionsText(actions) {
  return actions.map((item) => `${item.position} ${item.action}${item.size ? ` ${item.size}` : ""}`).join(" / ");
}

function handBoardSummary(hand) {
  const items = [
    formatBoard(hand, "flop") ? `Flop ${formatBoard(hand, "flop")}` : "",
    formatBoard(hand, "turn") ? `Turn ${formatBoard(hand, "turn")}` : "",
    formatBoard(hand, "river") ? `River ${formatBoard(hand, "river")}` : "",
  ].filter(Boolean);
  return items.join(" / ") || "-";
}

function handActionSummary(hand) {
  const items = [
    actionsText(hand.actions.preflop) ? `PF ${actionsText(hand.actions.preflop)}` : "",
    actionsText(hand.actions.flop) ? `F ${actionsText(hand.actions.flop)}` : "",
    actionsText(hand.actions.turn) ? `T ${actionsText(hand.actions.turn)}` : "",
    actionsText(hand.actions.river) ? `R ${actionsText(hand.actions.river)}` : "",
  ].filter(Boolean);
  return items.join(" | ") || "-";
}

function buildHandText(hand, index) {
  return [
    `#${index + 1} ${hand.heroPosition || "-"} / ${hand.heroHand || "-"}`,
    `Board: ${handBoardSummary(hand)}`,
    `Action: ${handActionSummary(hand)}`,
    `Result: ${hand.result || "-"}`,
    `Amount: ${hand.amountMemo || "-"}`,
    `Memo: ${hand.handMemo || "-"}`,
  ].join("\n");
}

function buildExportText(session) {
  return [
    "Session:",
    `Date: ${session.dateTime.replace("T", " ")}`,
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
    "",
    "Hands:",
    ...session.hands.map((hand, index) => [
      "",
      `${index + 1})`,
      `Hero: ${hand.heroPosition || "-"} / ${hand.heroHand || "-"}`,
      `PF: ${actionsText(hand.actions.preflop)}`,
      `Flop: ${formatBoard(hand, "flop")}${hand.board.flop ? " / " : ""}${actionsText(hand.actions.flop)}`,
      `Turn: ${formatBoard(hand, "turn")}${hand.board.turn ? " / " : ""}${actionsText(hand.actions.turn)}`,
      `River: ${formatBoard(hand, "river")}${hand.board.river ? " / " : ""}${actionsText(hand.actions.river)}`,
      `Board Tags: ${hand.board.tags.join(" / ")}`,
      `Result: ${hand.result}`,
      `Amount: ${hand.amountMemo}`,
      `Memo: ${hand.handMemo}`,
    ].join("\n")),
  ].join("\n");
}

function defaultLiveUiState() {
  return {
    action: true,
    board: true,
    heroHand: false,
    heroPosition: false,
    result: false,
    boardSuitInput: false,
    boardTags: false,
    quickHands: false,
  };
}

function summarizeAction(hand) {
  const ordered = [...streets]
    .reverse()
    .map((street) => hand.actions[street][hand.actions[street].length - 1])
    .filter(Boolean);
  if (!ordered.length) return "Not set";
  const latest = ordered[0];
  return `Last: ${latest.position} ${latest.action}${latest.size ? ` ${latest.size}` : ""}`;
}

function summarizeHeroPosition(hand) {
  return hand.heroPosition || "Not set";
}

function summarizeHeroHand(hand) {
  return hand.heroHand || "Not set";
}

function playerNotesDraftState(initialText) {
  return { savedText: initialText, draftText: initialText };
}

function editPlayerNotes(state, nextDraft) {
  return { ...state, draftText: nextDraft };
}

function savePlayerNotes(state) {
  return { ...state, savedText: state.draftText };
}

function cancelPlayerNotes(state) {
  return { ...state, draftText: state.savedText };
}

test("actions append in pressed order and never overwrite the same position", () => {
  let hand = newHand();
  hand = appendAction(hand, "preflop", "HJ", "Open");
  hand = appendAction(hand, "preflop", "BB", "3bet");
  hand = appendAction(hand, "preflop", "HJ", "Call");

  assert.equal(hand.actions.preflop.length, 3);
  assert.deepEqual(hand.actions.preflop.map((item) => `${item.position} ${item.action}`), ["HJ Open", "BB 3bet", "HJ Call"]);
});

test("bet amount is not required to save a useful hand note", () => {
  let hand = newHand();
  hand.heroPosition = "BTN";
  hand.heroHand = "AKo";
  hand = appendAction(hand, "preflop", "CO", "Open");
  hand = appendAction(hand, "preflop", "BTN", "3bet");
  hand.board.flop = "A72";
  hand = appendAction(hand, "flop", "CO", "Check");
  hand = appendAction(hand, "flop", "BTN", "Raise");
  hand.result = "Win";
  hand.amountMemo = "+4500";

  assert.equal(hand.heroPosition, "BTN");
  assert.equal(hand.actions.flop.length, 2);
  assert.equal(hand.amountMemo, "+4500");
});

test("hero hand supports rank1 rank2 suitedness and pair auto-complete", () => {
  assert.equal(selectHeroHand("A", "K", "s"), "AKs");
  assert.equal(selectHeroHand("A", "K", "o"), "AKo");
  assert.equal(selectHeroHand("J", "J"), "JJ");
  assert.equal(selectHeroHand("7", "7"), "77");
});

test("board rank buttons append and clear without keyboard input", () => {
  let board = { flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] };
  board = appendBoardRank(board, "flop", "A");
  board = appendBoardRank(board, "flop", "J");
  board = appendBoardRank(board, "flop", "7");
  board = appendBoardRank(board, "turn", "K");
  board = appendBoardRank(board, "river", "2");

  assert.deepEqual(board, { flop: "AJ7", flopSuits: "", turn: "K", turnSuit: "", river: "2", riverSuit: "", tags: [] });
  assert.equal(clearBoard(board, "flop").flop, "");
  assert.deepEqual(clearBoard(board), { flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] });
});

test("board suits format only when supplied and tolerate incomplete flop suits", () => {
  let board = { flop: "", flopSuits: "", turn: "", turnSuit: "", river: "", riverSuit: "", tags: [] };
  board = appendBoardRank(board, "flop", "9");
  board = appendBoardRank(board, "flop", "8");
  board = appendBoardRank(board, "flop", "6");
  board = appendBoardSuit(board, "flop", "h");
  board = appendBoardSuit(board, "flop", "h");
  board = appendBoardSuit(board, "flop", "d");
  board = appendBoardRank(board, "turn", "K");
  board = appendBoardSuit(board, "turn", "h");
  board = appendBoardRank(board, "river", "2");
  board = appendBoardSuit(board, "river", "c");

  const hand = { ...newHand(), board };
  assert.equal(formatBoard(hand, "flop"), "9h 8h 6d");
  assert.equal(formatBoard(hand, "turn"), "Kh");
  assert.equal(formatBoard(hand, "river"), "2c");

  const incomplete = { ...newHand(), board: { ...board, flopSuits: "hh" } };
  assert.equal(formatBoard(incomplete, "flop"), "9h 8h 6 (suit incomplete)");
});

test("postflop raise can carry optional size labels", () => {
  let hand = newHand();
  hand = appendAction(hand, "flop", "BB", "Raise", "50%");
  hand = appendAction(hand, "turn", "HJ", "Raise", "120%");
  hand = appendAction(hand, "flop", "BB", "All-in");

  assert.equal(actionsText(hand.actions.flop), "BB Raise 50% / BB All-in");
  assert.equal(actionsText(hand.actions.turn), "HJ Raise 120%");
});

test("live mode collapse defaults prioritize action and board", () => {
  const state = defaultLiveUiState();
  assert.equal(state.action, true);
  assert.equal(state.board, true);
  assert.equal(state.heroHand, false);
  assert.equal(state.heroPosition, false);
  assert.equal(state.result, false);
  assert.equal(state.boardSuitInput, false);
  assert.equal(state.boardTags, false);
  assert.equal(state.quickHands, false);
});

test("summaries are available even when sections are conceptually collapsed", () => {
  let hand = newHand();
  assert.equal(summarizeAction(hand), "Not set");
  assert.equal(summarizeHeroHand(hand), "Not set");
  assert.equal(summarizeHeroPosition(hand), "Not set");

  hand.heroHand = "AKo";
  hand.heroPosition = "CO";
  hand = appendAction(hand, "flop", "BTN", "Raise", "50%");

  assert.equal(summarizeAction(hand), "Last: BTN Raise 50%");
  assert.equal(summarizeHeroHand(hand), "AKo");
  assert.equal(summarizeHeroPosition(hand), "CO");
});

test("session export includes session memo, player notes, and linked hands", () => {
  let hand = newHand();
  hand.heroPosition = "HJ";
  hand.heroHand = "JJ";
  hand.board.flop = "986";
  hand.board.flopSuits = "hhd";
  hand.board.turn = "K";
  hand.board.turnSuit = "h";
  hand.board.river = "2";
  hand.board.riverSuit = "c";
  hand.board.tags = ["Wet", "Two-tone", "Connected"];
  hand = appendAction(hand, "preflop", "HJ", "Open");
  hand = appendAction(hand, "preflop", "BB", "3bet");
  hand = appendAction(hand, "preflop", "HJ", "Call");
  hand = appendAction(hand, "flop", "BB", "Raise", "50%");
  hand = appendAction(hand, "flop", "HJ", "Raise", "120%");
  hand.result = "Lose";
  hand.amountMemo = "-12000";
  hand.handMemo = "完成ストレートを軽視。";

  const session = {
    dateTime: "2026-04-30T19:30",
    place: "渋谷",
    stake: "1-3",
    buyIn: "30000",
    rebuy: "",
    cashOut: "42000",
    rakeMemo: "10% capあり",
    playerNotesText: "BTN: コール多め",
    sessionMemo: "ルースな卓",
    hands: [hand],
  };

  const text = buildExportText(session);
  assert.match(text, /Player Notes:\nBTN: コール多め/);
  assert.match(text, /PF: HJ Open \/ BB 3bet \/ HJ Call/);
  assert.match(text, /Flop: 9h 8h 6d \/ BB Raise 50% \/ HJ Raise 120%/);
  assert.match(text, /Turn: Kh/);
  assert.match(text, /River: 2c/);
  assert.match(text, /Board Tags: Wet \/ Two-tone \/ Connected/);
  assert.match(text, /Amount: -12000/);
});

test("hand summary shows hero, board, actions, result, amount, and memo preview content", () => {
  let hand = newHand();
  hand.heroPosition = "HJ";
  hand.heroHand = "JJ";
  hand.board.flop = "986";
  hand.board.flopSuits = "hhd";
  hand.board.turn = "K";
  hand.board.river = "2";
  hand = appendAction(hand, "preflop", "HJ", "Open");
  hand = appendAction(hand, "preflop", "BB", "3bet");
  hand = appendAction(hand, "preflop", "HJ", "Call");
  hand = appendAction(hand, "flop", "BB", "Raise", "50%");
  hand = appendAction(hand, "flop", "HJ", "Raise", "120%");
  hand.result = "Lose";
  hand.amountMemo = "-12000";
  hand.handMemo = "Q9に負け。完成ストレートを軽視。";

  assert.equal(handBoardSummary(hand), "Flop 9h 8h 6d / Turn K / River 2");
  assert.equal(handActionSummary(hand), "PF HJ Open / BB 3bet / HJ Call | F BB Raise 50% / HJ Raise 120%");
  assert.match(buildHandText(hand, 0), /#1 HJ \/ JJ/);
  assert.match(buildHandText(hand, 0), /Amount: -12000/);
  assert.match(buildHandText(hand, 0), /Memo: Q9に負け。完成ストレートを軽視。/);
});

test("all streets keep independent append-only logs", () => {
  let hand = newHand();
  for (const street of streets) {
    hand = appendAction(hand, street, "BB", street === "preflop" ? "Call" : "Check");
    hand = appendAction(hand, street, "HJ", street === "preflop" ? "Open" : "Raise");
  }

  assert.equal(hand.actions.preflop.length, 2);
  assert.equal(hand.actions.flop.length, 2);
  assert.equal(hand.actions.turn.length, 2);
  assert.equal(hand.actions.river.length, 2);
});

test("player notes update only on explicit save", () => {
  let state = playerNotesDraftState("BTN: コール多め");
  state = editPlayerNotes(state, "BTN: コール多め\nBB: 3bet少なめ");
  assert.equal(state.savedText, "BTN: コール多め");
  state = savePlayerNotes(state);
  assert.equal(state.savedText, "BTN: コール多め\nBB: 3bet少なめ");
});

test("player notes cancel discards unsaved changes", () => {
  let state = playerNotesDraftState("UTG: タイト");
  state = editPlayerNotes(state, "UTG: タイト\nCO: ルース");
  state = cancelPlayerNotes(state);
  assert.equal(state.savedText, "UTG: タイト");
  assert.equal(state.draftText, "UTG: タイト");
});
