import type { Hand, HandAction, HandParticipant, Session, SessionPlayer, Street } from "./types";

export function parseAmount(input: string | number | undefined, amountInputUnit: number) {
  if (input === undefined || input === "") return undefined;
  const normalized = typeof input === "number" ? input : Number(String(input).replaceAll(",", ""));
  if (!Number.isFinite(normalized)) return undefined;
  return Math.round(normalized * amountInputUnit);
}

export function formatAmount(amount: number | undefined, unitName?: string) {
  if (amount === undefined || Number.isNaN(amount)) return "-";
  return `${amount.toLocaleString()}${unitName ? ` ${unitName}` : ""}`;
}

export function amountToBb(amount: number | undefined, bigBlindAmount: number) {
  if (amount === undefined || !bigBlindAmount) return undefined;
  return amount / bigBlindAmount;
}

export function formatBb(amount: number | undefined, bigBlindAmount: number) {
  const bb = amountToBb(amount, bigBlindAmount);
  if (bb === undefined) return "-";
  return `${Number.isInteger(bb) ? bb : bb.toFixed(1)}BB`;
}

export function estimateRake(potAmount: number, session: Session) {
  const percent = Math.max(0, session.rakePercent || 0) / 100;
  const cap = Math.max(0, session.rakeCapBb || 0) * session.bigBlindAmount;
  if (!percent || !cap) return 0;
  return Math.min(potAmount * percent, cap);
}

export function occupiedSeatPlayers(players: SessionPlayer[]) {
  return [...players].sort((a, b) => a.seatNumber - b.seatNumber);
}

export function seatPlayerMap(players: SessionPlayer[]) {
  return new Map(players.map((player) => [player.seatNumber, player]));
}

export function nextOccupiedSeat(players: SessionPlayer[], fromSeat: number, step = 1) {
  const occupied = new Set(players.map((player) => player.seatNumber));
  let seat = fromSeat;
  for (let i = 0; i < 9; i += 1) {
    seat = ((seat - 1 + step) % 9) + 1;
    if (occupied.has(seat)) return seat;
  }
  return undefined;
}

export function deriveButtonBlindSeats(players: SessionPlayer[], buttonSeat?: number) {
  if (!buttonSeat) return {};
  const sbSeat = nextOccupiedSeat(players, buttonSeat);
  const bbSeat = sbSeat ? nextOccupiedSeat(players, sbSeat) : undefined;
  return { buttonSeat, sbSeat, bbSeat };
}

export function orderedActionSeats(players: SessionPlayer[], buttonSeat: number, street: Street) {
  const seated = occupiedSeatPlayers(players);
  const occupied = new Set(seated.map((player) => player.seatNumber));
  if (!occupied.size) return [];

  const { bbSeat } = deriveButtonBlindSeats(seated, buttonSeat);
  const startAfter = street === "preflop" ? bbSeat || buttonSeat : buttonSeat;
  const seats: number[] = [];
  let seat = startAfter;

  for (let i = 0; i < 9; i += 1) {
    seat = ((seat - 1 + 1) % 9) + 1;
    if (occupied.has(seat)) seats.push(seat);
  }

  return seats;
}

export function activeParticipantIds(hand: Pick<Hand, "actions" | "participants">, street: Street) {
  const streetOrder: Street[] = ["preflop", "flop", "turn", "river"];
  const targetIndex = streetOrder.indexOf(street);
  const folded = new Set<string>();
  const allin = new Set<string>();

  hand.actions
    .filter((action) => streetOrder.indexOf(action.street) <= targetIndex)
    .forEach((action) => {
      if (action.actionType === "fold") folded.add(action.actorSessionPlayerId);
      if (action.actionType === "allin") allin.add(action.actorSessionPlayerId);
    });

  return hand.participants
    .filter((participant) => !folded.has(participant.sessionPlayerId) && !allin.has(participant.sessionPlayerId))
    .map((participant) => participant.sessionPlayerId);
}

export function estimatePot(actions: HandAction[]) {
  return actions.reduce((sum, action) => sum + (action.amount || 0), 0);
}

export function summarizePlayerStats(player: SessionPlayer, hands: Hand[], bigBlindAmount: number) {
  const involved = hands.filter((hand) => hand.participants.some((participant) => participant.sessionPlayerId === player.id));
  const showdowns = involved.filter((hand) =>
    hand.participants.some(
      (participant) => participant.sessionPlayerId === player.id && participant.showdownStatus === "shown"
    )
  );
  const heroOpponentHands = involved.filter((hand) => {
    const hasHero = hand.participants.some((participant) => participant.isHero);
    return hasHero && !player.isHero;
  });
  const largePots = involved.filter((hand) => (hand.potAmount || estimatePot(hand.actions)) >= bigBlindAmount * 30);

  return {
    involvedHands: involved.length,
    showdownsSeen: showdowns.length,
    heroMatches: player.isHero ? involved.length : heroOpponentHands.length,
    largePots: largePots.length,
  };
}

export function participantLabel(participant: HandParticipant) {
  return `Seat${participant.seatNumber} ${participant.displayName}${participant.position ? ` ${participant.position}` : ""}`;
}
