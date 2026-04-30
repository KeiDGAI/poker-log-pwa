import type { PlayerTendencies, PlayUnit, Position } from "./types";

export const COUNTRIES = ["日本", "韓国", "シンガポール", "フィリピン", "アメリカ", "その他"];

export const DEFAULT_PLAY_UNITS: Omit<PlayUnit, "id" | "createdAt">[] = [
  { name: "USD", type: "fiat", isDefault: true },
  { name: "KRW", type: "fiat", isDefault: true },
  { name: "SGD", type: "fiat", isDefault: true },
  { name: "EUR", type: "fiat", isDefault: true },
  { name: "HKD", type: "fiat", isDefault: true },
  { name: "PHP", type: "fiat", isDefault: true },
  { name: "Webcoin", type: "amusement_point", country: "日本", isDefault: true },
];

export const POSITIONS: Position[] = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

export const SUITS = [
  { label: "♠", value: "s", color: "text-zinc-950" },
  { label: "♥", value: "h", color: "text-red-700" },
  { label: "♦", value: "d", color: "text-red-700" },
  { label: "♣", value: "c", color: "text-zinc-950" },
];

export const TENDENCY_OPTIONS: Record<keyof PlayerTendencies, string[]> = {
  vpip: ["高い", "普通", "低い"],
  cbCall: ["高い", "普通", "低い"],
  limp: ["あり", "なし"],
  coldCallNonBtnBb: ["あり", "なし"],
  threeBet: ["多い", "普通", "少ない"],
  flopCheckRaise: ["高頻度", "たまに", "なし"],
  wetBoardCall: ["コール多い", "変わらず"],
  overbet: ["リバーバリュー気味のみ", "ターンまでにもあり", "なし"],
  showdown: ["薄くコールする", "強い手中心", "不明"],
  riverBigBet: ["ほぼバリュー", "ブラフあり", "不明"],
};

export const TENDENCY_LABELS: Record<keyof PlayerTendencies, string> = {
  vpip: "VPIP",
  cbCall: "CBへのコール頻度",
  limp: "リンプ",
  coldCallNonBtnBb: "BTN・BB以外でのコールドコール",
  threeBet: "3bet",
  flopCheckRaise: "フロップチェックレイズ",
  wetBoardCall: "ウェットボード時",
  overbet: "ポットオーバーベット",
  showdown: "ショーダウン傾向",
  riverBigBet: "リバー大型ベット",
};
