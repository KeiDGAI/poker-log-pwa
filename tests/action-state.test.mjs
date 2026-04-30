import assert from "node:assert/strict";
import test from "node:test";

const order = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const session = { smallBlindAmount: 50, bigBlindAmount: 100, rakePercent: 5, rakeCapBb: 3 };
const streetOrder = ["preflop", "flop", "turn", "river"];

function initState() {
  return {
    street: "preflop",
    currentBet: session.bigBlindAmount,
    minimumRaiseIncrement: session.bigBlindAmount,
    status: Object.fromEntries(order.map((id) => [id, "ACTIVE"])),
    contribution: { SB: session.smallBlindAmount, BB: session.bigBlindAmount },
    pendingPlayers: order.filter((id) => id !== "BB"),
    actions: [
      { street: "preflop", playerId: "SB", actionType: "BLIND", amountChips: 50, note: "BLIND" },
      { street: "preflop", playerId: "BB", actionType: "BLIND", amountChips: 100, note: "BLIND" },
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
  let loggedAmount = amountChips;
  if (actionType === "FOLD") {
    next.status[playerId] = "FOLDED";
    next.pendingPlayers = next.pendingPlayers.filter((id) => id !== playerId);
  }
  if (actionType === "CALL") {
    next.contribution[playerId] = next.currentBet;
    loggedAmount = next.currentBet;
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
  next.actions.push({ street: next.street, playerId, actionType, amountChips: loggedAmount, note: "USER" });
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

function scenarioRequestedReraise() {
  let state = initState();
  state = act(state, "UTG", "FOLD");
  state = act(state, "UTG1", "FOLD");
  state = act(state, "UTG2", "FOLD");
  state = act(state, "LJ", "FOLD");
  state = act(state, "HJ", "RAISE", 900);
  state = act(state, "CO", "FOLD");
  state = act(state, "BTN", "CALL");
  state = act(state, "SB", "FOLD");
  state = act(state, "BB", "RAISE", 2000);
  return state;
}

function playerActions(state, playerId, street = "preflop") {
  return state.actions.filter((action) => action.street === street && action.playerId === playerId && action.note !== "BLIND");
}

function streetParticipants(state, street) {
  const streetIndex = streetOrder.indexOf(street);
  return order.filter((id) => !state.actions.some((action) => (
    action.playerId === id &&
    action.actionType === "FOLD" &&
    streetOrder.indexOf(action.street) < streetIndex
  )));
}

function displayForStreet(state, street) {
  return Object.fromEntries(streetParticipants(state, street).map((id) => [
    id,
    playerActions(state, id, street).map((action) => `${action.actionType}${action.amountChips ? ` ${action.amountChips}` : ""}`).join(" / ") || "UNINPUT",
  ]));
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

test("HJ gets next action after HJ raise, BTN call, BB raise", () => {
  const state = scenarioRequestedReraise();
  assert.deepEqual(state.pendingPlayers, ["HJ", "BTN"]);
});

test("HJ Call 20 appends without deleting HJ Raise 9", () => {
  const state = act(scenarioRequestedReraise(), "HJ", "CALL");
  assert.deepEqual(playerActions(state, "HJ").map((action) => action.actionType), ["RAISE", "CALL"]);
});

test("HJ has both HJ Raise 9 and HJ Call 20 action logs", () => {
  const state = act(scenarioRequestedReraise(), "HJ", "CALL");
  assert.deepEqual(playerActions(state, "HJ").map((action) => action.amountChips), [900, 2000]);
});

test("BTN second call appends without deleting first BTN call", () => {
  let state = act(scenarioRequestedReraise(), "HJ", "CALL");
  state = act(state, "BTN", "CALL");
  assert.deepEqual(playerActions(state, "BTN").map((action) => action.amountChips), [900, 2000]);
});

test("folded player remains visible as Fold on same street", () => {
  const state = scenarioRequestedReraise();
  assert.equal(displayForStreet(state, "preflop").UTG, "FOLD");
});

test("folded player is not an action candidate on same street", () => {
  const state = scenarioRequestedReraise();
  assert.ok(!state.pendingPlayers.includes("UTG"));
  assert.ok(!state.pendingPlayers.includes("CO"));
});

test("preflop folded players are hidden on flop", () => {
  const state = scenarioRequestedReraise();
  assert.ok(!streetParticipants(state, "flop").includes("UTG"));
  assert.ok(!streetParticipants(state, "flop").includes("CO"));
});

test("flop folded player remains on flop display and is hidden on turn", () => {
  let state = {
    ...initState(),
    street: "flop",
    currentBet: 0,
    contribution: {},
    pendingPlayers: ["HJ", "BTN", "BB"],
    actions: [],
    status: { ...Object.fromEntries(order.map((id) => [id, "FOLDED"])), HJ: "ACTIVE", BTN: "ACTIVE", BB: "ACTIVE" },
  };
  state = act(state, "HJ", "BET", 900);
  state = act(state, "BTN", "FOLD");
  state = act(state, "BB", "CALL");
  assert.equal(displayForStreet(state, "flop").BTN, "FOLD");
  assert.ok(!streetParticipants(state, "turn").includes("BTN"));
});
