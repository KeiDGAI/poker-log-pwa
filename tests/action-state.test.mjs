import assert from "node:assert/strict";
import test from "node:test";

const players = ["UTG", "HJ", "CO", "BTN", "SB", "BB"].map((position, index) => ({
  id: position,
  seatNumber: index + 1,
  position,
}));

const session = {
  smallBlindAmount: 50,
  bigBlindAmount: 100,
  amountInputUnit: 1,
  rakePercent: 5,
  rakeCapBb: 3,
};

function blindActions() {
  return [
    { street: "preflop", playerId: "SB", actionType: "BLIND", amountChips: 50, note: "BLIND", order: 0 },
    { street: "preflop", playerId: "BB", actionType: "BLIND", amountChips: 100, note: "BLIND", order: 1 },
  ];
}

function initState() {
  return {
    street: "preflop",
    currentBet: session.bigBlindAmount,
    minRaise: session.bigBlindAmount,
    actions: blindActions(),
    status: Object.fromEntries(players.map((player) => [player.id, "ACTIVE"])),
    contribution: { SB: 50, BB: 100 },
    order: players.map((player) => player.id),
  };
}

function candidates(state) {
  return state.order.filter((id) => state.status[id] === "ACTIVE");
}

function required(state) {
  return candidates(state).filter((id) => {
    const userAction = [...state.actions].reverse().find((action) => action.playerId === id && action.note !== "BLIND" && action.street === state.street);
    if (!userAction) return true;
    if (state.currentBet === 0) return false;
    return (state.contribution[id] || 0) < state.currentBet;
  });
}

function act(state, playerId, actionType, amountChips = 0, note = "USER") {
  assert.equal(required(state)[0], playerId);
  const next = structuredClone(state);
  if (actionType === "FOLD") next.status[playerId] = "FOLDED";
  if (actionType === "ALL_IN") next.status[playerId] = "ALL_IN";
  if (actionType === "CALL") next.contribution[playerId] = next.currentBet;
  if (actionType === "BET" || actionType === "RAISE") {
    assert.ok(amountChips > next.currentBet);
    next.minRaise = amountChips - next.currentBet;
    next.currentBet = amountChips;
    next.contribution[playerId] = amountChips;
  }
  if (actionType === "ALL_IN") {
    next.contribution[playerId] = amountChips;
    if (amountChips >= next.currentBet + next.minRaise) {
      next.minRaise = amountChips - next.currentBet;
      next.currentBet = amountChips;
    }
  }
  next.actions.push({ street: next.street, playerId, actionType, amountChips, note, order: next.actions.length });
  return next;
}

function foldTo(state, targetPlayerId) {
  let next = structuredClone(state);
  while (required(next)[0] && required(next)[0] !== targetPlayerId) {
    next = act(next, required(next)[0], "FOLD", 0, "AUTO");
  }
  return next;
}

function pot(state) {
  const byStreetPlayer = new Map();
  state.actions.forEach((action) => {
    if (!action.amountChips) return;
    byStreetPlayer.set(`${action.street}:${action.playerId}`, Math.max(byStreetPlayer.get(`${action.street}:${action.playerId}`) || 0, action.amountChips));
  });
  return [...byStreetPlayer.values()].reduce((sum, amount) => sum + amount, 0);
}

function rake(amount) {
  return Math.min(amount * (session.rakePercent / 100), session.rakeCapBb * session.bigBlindAmount);
}

test("preflop starts with SB/BB blinds and first actor left of BB", () => {
  const state = initState();
  assert.deepEqual(state.actions.map((action) => action.note), ["BLIND", "BLIND"]);
  assert.equal(required(state)[0], "UTG");
});

test("folded players leave future action candidates", () => {
  const state = act(initState(), "UTG", "FOLD");
  assert.equal(state.status.UTG, "FOLDED");
  assert.ok(!candidates(state).includes("UTG"));
});

test("foldTo records AUTO folds and moves target to next actor", () => {
  const state = foldTo(initState(), "BTN");
  assert.equal(state.status.UTG, "FOLDED");
  assert.equal(state.status.HJ, "FOLDED");
  assert.equal(state.status.CO, "FOLDED");
  assert.deepEqual(state.actions.slice(2).map((action) => action.note), ["AUTO", "AUTO", "AUTO"]);
  assert.equal(required(state)[0], "BTN");
});

test("bet/raise amount is stored as chip total", () => {
  const state = act(initState(), "UTG", "RAISE", 250);
  assert.equal(state.actions.at(-1).amountChips, 250);
  assert.equal(state.contribution.UTG, 250);
});

test("raise sends action back to unmatched active players", () => {
  let state = act(initState(), "UTG", "RAISE", 250);
  state = act(state, "HJ", "CALL");
  state = act(state, "CO", "FOLD");
  state = act(state, "BTN", "CALL");
  state = act(state, "SB", "FOLD");
  state = act(state, "BB", "RAISE", 600);
  assert.deepEqual(required(state), ["UTG", "HJ", "BTN"]);
});

test("all-in player leaves action candidates but remains eligible for result", () => {
  const state = act(initState(), "UTG", "ALL_IN", 250);
  assert.equal(state.status.UTG, "ALL_IN");
  assert.ok(!candidates(state).includes("UTG"));
  assert.ok(Object.keys(state.status).includes("UTG"));
});

test("past action change is modeled by truncating following actions", () => {
  let state = act(initState(), "UTG", "RAISE", 250);
  state = act(state, "HJ", "CALL");
  state.actions = state.actions.filter((action) => action.note === "BLIND");
  state.status = Object.fromEntries(players.map((player) => [player.id, "ACTIVE"]));
  state.contribution = { SB: 50, BB: 100 };
  state = act(state, "UTG", "FOLD");
  assert.equal(state.actions.at(-1).actionType, "FOLD");
  assert.ok(!state.actions.some((action) => action.playerId === "HJ"));
});

test("single remaining active player can go to result", () => {
  let state = foldTo(initState(), "BTN");
  state = act(state, "BTN", "RAISE", 300);
  state = act(state, "SB", "FOLD");
  state = act(state, "BB", "FOLD");
  assert.equal(candidates(state).length, 1);
});

test("manual result amount drives movedBb", () => {
  const state = act(initState(), "UTG", "RAISE", 250);
  const resultAmount = pot(state) - rake(pot(state));
  assert.equal(resultAmount / session.bigBlindAmount, 3.8);
});
