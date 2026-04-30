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
  hand = appendAction(hand, "flop", "BTN", "Bet");
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

test("postflop bet and raise can carry optional size labels", () => {
  let hand = newHand();
  hand = appendAction(hand, "flop", "BB", "Bet", "50%");
  hand = appendAction(hand, "flop", "HJ", "Raise", "120%");
  hand = appendAction(hand, "flop", "BB", "All-in");

  assert.equal(actionsText(hand.actions.flop), "BB Bet 50% / HJ Raise 120% / BB All-in");
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
  hand = appendAction(hand, "flop", "BB", "Bet", "50%");
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
  assert.match(text, /Flop: 9h 8h 6d \/ BB Bet 50% \/ HJ Raise 120%/);
  assert.match(text, /Turn: Kh/);
  assert.match(text, /River: 2c/);
  assert.match(text, /Board Tags: Wet \/ Two-tone \/ Connected/);
  assert.match(text, /Amount: -12000/);
});

test("all streets keep independent append-only logs", () => {
  let hand = newHand();
  for (const street of streets) {
    hand = appendAction(hand, street, "BB", street === "preflop" ? "Call" : "Check");
    hand = appendAction(hand, street, "HJ", street === "preflop" ? "Open" : "Bet");
  }

  assert.equal(hand.actions.preflop.length, 2);
  assert.equal(hand.actions.flop.length, 2);
  assert.equal(hand.actions.turn.length, 2);
  assert.equal(hand.actions.river.length, 2);
});
