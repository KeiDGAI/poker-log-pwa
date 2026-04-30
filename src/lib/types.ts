export type CountryName = "日本" | "韓国" | "シンガポール" | "フィリピン" | "アメリカ" | string;

export type SyncStatus = "local_draft" | "sync_pending" | "synced_readonly" | "sync_failed";

export type PlayUnitType = "fiat" | "casino_chip" | "amusement_point" | "other";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type Position = "UTG" | "UTG1" | "UTG2" | "LJ" | "HJ" | "CO" | "BTN" | "SB" | "BB";

export type ActionType = "blind" | "straddle" | "fold" | "check" | "call" | "bet_raise" | "allin";

export type ShowdownStatus = "shown" | "mucked" | "unknown" | "not_reached";

export type PlayerTendencies = {
  vpip?: "高い" | "普通" | "低い" | "不明";
  cbCall?: "高い" | "普通" | "低い" | "不明";
  limp?: "あり" | "なし" | "不明";
  coldCallNonBtnBb?: "あり" | "なし" | "不明";
  threeBet?: "多い" | "普通" | "少ない" | "不明";
  flopCheckRaise?: "高頻度" | "たまに" | "なし" | "不明";
  wetBoardCall?: "コール多い" | "変わらず" | "不明";
  overbet?: "リバーバリュー気味のみ" | "ターンまでにもあり" | "なし" | "不明";
  showdown?: "薄くコールする" | "強い手中心" | "不明";
  riverBigBet?: "ほぼバリュー" | "ブラフあり" | "不明";
};

export type UserProfile = {
  id: string;
  heroName: string;
  defaultPlayUnitId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlayUnit = {
  id: string;
  name: string;
  type: PlayUnitType;
  country?: CountryName;
  isDefault: boolean;
  createdByUserId?: string;
  createdAt: string;
};

export type Venue = {
  id: string;
  country: CountryName;
  name: string;
  type: "casino" | "amusement" | "other";
  lastUsedAt: string;
  createdAt: string;
};

export type SavedRate = {
  id: string;
  venueId?: string;
  playUnitId: string;
  label: string;
  smallBlindAmount: number;
  bigBlindAmount: number;
  amountInputUnit: number;
  lastUsedAt: string;
};

export type Session = {
  id: string;
  date: string;
  country: CountryName;
  venueId?: string;
  venueName: string;
  playUnitId: string;
  playUnitName: string;
  rateLabel: string;
  smallBlindAmount: number;
  bigBlindAmount: number;
  amountInputUnit: number;
  startStackAmount?: number;
  endStackAmount?: number;
  rakePercent: number;
  rakeCapBb: number;
  memo?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type PlayerProfile = {
  id: string;
  nickname: string;
  aliases: string[];
  globalNotes?: string;
  tendencies: PlayerTendencies;
  createdAt: string;
  updatedAt: string;
};

export type SeatHistory = {
  id: string;
  seatNumber: number;
  startedAtHandNumber?: number;
  endedAtHandNumber?: number;
  isCurrent: boolean;
};

export type SessionPlayer = {
  id: string;
  sessionId: string;
  playerProfileId?: string;
  displayName: string;
  seatNumber: number;
  isHero: boolean;
  sessionNotes?: string;
  sessionTendencies: PlayerTendencies;
  seatHistory: SeatHistory[];
  createdAt: string;
  updatedAt: string;
};

export type HandParticipant = {
  id: string;
  sessionPlayerId: string;
  displayName: string;
  isHero: boolean;
  seatNumber: number;
  position?: Position;
  startingStackAmount?: number;
  holeCards: string[];
  foldedStreet?: Street;
  isAllIn?: boolean;
  showdownStatus: ShowdownStatus;
  showdownCards: string[];
  resultAmount?: number;
};

export type HandAction = {
  id: string;
  street: Street;
  actorSessionPlayerId: string;
  actionType: ActionType;
  amount?: number;
  note?: string;
  order: number;
};

export type HandBoard = {
  flop: string[];
  turn?: string;
  river?: string;
};

export type Hand = {
  id: string;
  sessionId: string;
  handNumber: number;
  participants: HandParticipant[];
  board: HandBoard;
  actions: HandAction[];
  resultText?: string;
  movedBb?: number;
  potAmount?: number;
  rakeAmount?: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};
