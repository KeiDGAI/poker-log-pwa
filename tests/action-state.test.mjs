import assert from "node:assert/strict";
import test from "node:test";

const order = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const session = { smallBlindAmount: 50, bigBlindAmount: 100, rakePercent: 5, rakeCapBb: 3 };

function initState() {
  return {
    currentBet: session.bigBlindAmount,
    minimumRaiseIncrement: session.bigBlindAmount,
    status: Object.fromEntries(order.map((id) => [id, "ACTIVE"])),
    contribution: { SB: session.smallBlindAmount, BB: session.bigBlindAmount },
    pendingPlayers: order.filter((id) => id !== "BB"),
    actions: [
      { playerId: "SB", actionType: "BLIND", amountChips: 50, note: "BLIND" },
      { playerId: "BB", actionType: "BLIND", amountChips: 100, note: "BLIND" },
    ],
  };
}

function activeAfter(actorId, state) {
  const start = order.indexOf(actorId);
  return [...order.slice(start + 1), ...order.slice(0, start)]
    .filter((id) => id !== actorId && state.status[id] === "ACTIVE");
}

function act(state, playerId, actionType, amountChips = 0) {
  assert.equal(state.pendingPlayers[0], playerId);
  const next = structuredClone(state);
  if (actionType === "FOLD") {
    next.status[playerId] = "FOLDED";
    next.pendingPlayers = next.pendingPlayers.filter((id) => id !== playerId);
  }
  if (actionType === "CALL") {
    next.contribution[playerId] = next.currentBet;
    next.pendingPlayers = next.pendingPlayers.filter((id) => id !== playerId);
  }
  if (actionType === "RAISE" || actionType === "BET") {
    assert.ok(amountChips > next.currentBet);
    next.minimumRaiseIncrement = amountChips - next.currentBet;
    next.currentBet = amountChips;
    next.contribution[playerId] = amountChips;
    next.pendingPlayers = activeAfter(playerId, next);
  }
  if (actionType === "ALL_IN") {
    next.status[playerId] = "ALL_IN";
    next.contribution[playerId] = amountChips;
    const isFullRaise = amountChips >= next.currentBet + next.minimumRaiseIncrement;
    if (isFullRaise) {
      next.minimumRaiseIncrement = amountChips - next.currentBet;
      next.currentBet = amountChips;
      next.pendingPlayers = activeAfter(playerId, next);
    } else {
      next.pendingPlayers = next.pendingPlayers.filter((id) => id !== playerId);
    }
  }
  next.actions.push({ playerId, actionType, amountChips, note: "USER" });
  return next;
}

function scenarioToBbReraise() {
  let state = act(initState(), "UTG", "RAISE", 300);
  state = act(state, "UTG1", "FOLD");
  state = act(state, "UTG2", "FOLD");
  state = act(state, "LJ", "FOLD");
  state = act(state, "HJ", "FOLD");
  state = act(state, "CO", "FOLD");
  state = act(state, "BTN", "CALL");
  state = act(state, "SB", "FOLD");
  state = act(state, "BB", "RAISE", 900);
  return state;
}

test("UTG Raise 300 makes every other active player pending in table order", () => {
  const state = act(initState(), "UTG", "RAISE", 300);
  assert.equal(state.currentBet, 300);
  assert.equal(state.contribution.UTG, 300);
  assert.deepEqual(state.pendingPlayers, ["UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"]);
});

test("UTG raise, BTN call, BB raise makes UTG and BTN pending", () => {
  const state = scenarioToBbReraise();
  assert.equal(state.currentBet, 900);
  assert.equal(state.contribution.BB, 900);
  assert.deepEqual(state.pendingPlayers, ["UTG", "BTN"]);
});

test("UTG call after BB raise leaves only BTN pending", () => {
  const state = act(scenarioToBbReraise(), "UTG", "CALL");
  assert.equal(state.contribution.UTG, 900);
  assert.deepEqual(state.pendingPlayers, ["BTN"]);
});

test("BTN raise 2000 sends action to BB then UTG", () => {
  let state = act(scenarioToBbReraise(), "UTG", "CALL");
  state = act(state, "BTN", "RAISE", 2000);
  assert.equal(state.currentBet, 2000);
  assert.equal(state.contribution.BTN, 2000);
  assert.deepEqual(state.pendingPlayers, ["BB", "UTG"]);
});

test("folded players are never re-added to pending after raise", () => {
  const state = scenarioToBbReraise();
  assert.equal(state.status.UTG1, "FOLDED");
  assert.equal(state.status.SB, "FOLDED");
  assert.ok(!state.pendingPlayers.includes("UTG1"));
  assert.ok(!state.pendingPlayers.includes("SB"));
});

test("all-in players are never re-added to pending after later raise", () => {
  let state = act(initState(), "UTG", "ALL_IN", 300);
  state = act(state, "UTG1", "FOLD");
  state = act(state, "UTG2", "FOLD");
  state = act(state, "LJ", "RAISE", 900);
  assert.equal(state.status.UTG, "ALL_IN");
  assert.ok(!state.pendingPlayers.includes("UTG"));
});

test("street ends when pendingPlayers becomes empty", () => {
  let state = act(scenarioToBbReraise(), "UTG", "CALL");
  state = act(state, "BTN", "RAISE", 2000);
  state = act(state, "BB", "CALL");
  state = act(state, "UTG", "CALL");
  assert.deepEqual(state.pendingPlayers, []);
});
