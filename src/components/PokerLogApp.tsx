"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  Cloud,
  Copy,
  FileText,
  Home,
  Layers,
  Plus,
  Save,
  Search,
  Settings2,
  Spade,
  Trash2,
  X,
} from "lucide-react";
import { COUNTRIES, RANKS, SUITS, TENDENCY_LABELS, TENDENCY_OPTIONS } from "@/lib/constants";
import { db, nowIso, seedDefaults, uid } from "@/lib/db";
import {
  amountToBb,
  activeSessionPlayers,
  deriveButtonBlindSeats,
  derivePositionsByButton,
  estimatePot,
  estimateRake,
  formatAmount,
  formatBb,
  orderedActionSeats,
  orderedPostflopPlayers,
  orderedPreflopPlayers,
  parseAmount,
  participantLabel,
  positionedPlayers,
  POSITIONS_BY_PLAYERS,
  seatPlayerMap,
  summarizePlayerStats,
} from "@/lib/poker";
import { uploadSessionBundle } from "@/lib/sync";
import type {
  ActionType,
  Hand,
  HandAction,
  HandParticipant,
  PlayerProfile,
  PlayerTendencies,
  PlayUnit,
  Position,
  SavedRate,
  Session,
  SessionPlayer,
  ShowdownStatus,
  Street,
  UserProfile,
  Venue,
} from "@/lib/types";

type View = "home" | "session" | "table" | "game" | "export" | "history" | "game-history";
type SheetMode = "player" | "tendency" | "amount" | "card" | "rake" | null;
type GameStep = "button" | "preflop" | "flop-card" | "flop" | "turn-card" | "turn" | "river-card" | "river" | "showdown" | "result";

const SEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const seatPositions: Record<number, string> = {
  1: "left-[50%] top-[2%] -translate-x-1/2",
  2: "right-[14%] top-[10%]",
  3: "right-[2%] top-[38%]",
  4: "right-[12%] bottom-[12%]",
  5: "left-[56%] bottom-[2%]",
  6: "left-[32%] bottom-[2%]",
  7: "left-[10%] bottom-[12%]",
  8: "left-[2%] top-[38%]",
  9: "left-[14%] top-[10%]",
};

const streetLabels: Record<Street, string> = {
  preflop: "プリフロップ",
  flop: "フロップ",
  turn: "ターン",
  river: "リバー",
  showdown: "ショーダウン",
};

const actionLabels: Record<ActionType, string> = {
  blind: "ブラインド",
  straddle: "ストラドル",
  fold: "フォールド",
  check: "チェック",
  call: "コール",
  bet_raise: "レイズ",
  allin: "オールイン",
};

const nextStep: Partial<Record<GameStep, GameStep>> = {
  button: "preflop",
  preflop: "flop-card",
  "flop-card": "flop",
  flop: "turn-card",
  "turn-card": "turn",
  turn: "river-card",
  "river-card": "river",
  river: "showdown",
  showdown: "result",
};

export function PokerLogApp() {
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("home");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [playUnits, setPlayUnits] = useState<PlayUnit[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [savedRates, setSavedRates] = useState<SavedRate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayer[]>([]);
  const [hands, setHands] = useState<Hand[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");

  async function refresh() {
    await seedDefaults();
    const [profiles, units, venueRows, rateRows, sessionRows, playerRows, globalPlayers, handRows] = await Promise.all([
      db.userProfiles.toArray(),
      db.playUnits.toArray(),
      db.venues.orderBy("lastUsedAt").reverse().toArray(),
      db.savedRates.orderBy("lastUsedAt").reverse().toArray(),
      db.sessions.orderBy("updatedAt").reverse().toArray(),
      db.sessionPlayers.toArray(),
      db.playerProfiles.orderBy("updatedAt").reverse().toArray(),
      db.hands.toArray(),
    ]);
    setProfile(profiles[0] || null);
    setPlayUnits(units);
    setVenues(venueRows);
    setSavedRates(rateRows);
    setSessions(sessionRows);
    setSessionPlayers(playerRows);
    setPlayerProfiles(globalPlayers);
    setHands(handRows);
    if (!activeSessionId && sessionRows[0]) setActiveSessionId(sessionRows[0].id);
    setLoaded(true);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const sessionRoster = useMemo(
    () => sessionPlayers.filter((player) => player.sessionId === activeSession?.id).sort((a, b) => a.seatNumber - b.seatNumber),
    [activeSession?.id, sessionPlayers]
  );
  const activePlayers = useMemo(() => activeSessionPlayers(sessionRoster), [sessionRoster]);
  const activeGames = useMemo(
    () => hands.filter((hand) => hand.sessionId === activeSession?.id).sort((a, b) => a.handNumber - b.handNumber),
    [activeSession?.id, hands]
  );

  if (!loaded) return <div className="grid h-dvh place-items-center bg-[#f2eee5] text-stone-700">読み込み中...</div>;
  if (!profile) return <Onboarding onDone={refresh} />;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#f2eee5] text-stone-950">
      <AppHeader
        title={view === "home" ? "ホーム" : activeSession ? `${activeSession.venueName} ${activeSession.rateLabel}` : "セッション"}
        subtitle="ポーカープレーログ"
        showBack={view !== "home"}
        onBack={() => setView("home")}
      />
      <section className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
        {view === "home" && (
          <HomeScreen
            session={activeSession}
            games={activeGames}
            profile={profile}
            onOpenSession={() => setView(activeSession ? "table" : "session")}
            onNewSession={() => setView("session")}
            onExport={() => setView("export")}
            onHistory={() => setView("history")}
          />
        )}
        {view === "session" && (
          <SessionForm
            profile={profile}
            playUnits={playUnits}
            venues={venues}
            savedRates={savedRates}
            onDone={async (id) => {
              await refresh();
              setActiveSessionId(id);
              setView("table");
            }}
          />
        )}
        {view === "table" && activeSession && (
          <TableScreen
            session={activeSession}
            profile={profile}
            players={activePlayers}
            roster={sessionRoster}
            games={activeGames}
            playerProfiles={playerProfiles}
            onRefresh={refresh}
            onGame={() => setView("game")}
            onGameHistory={() => setView("game-history")}
            onHome={() => setView("home")}
          />
        )}
        {view === "game" && activeSession && (
          <SimpleGameInput session={activeSession} players={activePlayers} games={activeGames} onDone={async () => {
            await refresh();
            setView("table");
          }} />
        )}
        {view === "export" && activeSession && (
          <ExportPanel session={activeSession} players={activePlayers} games={activeGames} onDone={refresh} />
        )}
        {view === "game-history" && activeSession && (
          <GameHistoryScreen session={activeSession} games={activeGames} onBack={() => setView("table")} />
        )}
        {view === "history" && (
          <HistoryPanel
            sessions={sessions}
            onSelect={(id) => {
              setActiveSessionId(id);
              setView("table");
            }}
          />
        )}
      </section>
    </main>
  );
}

function AppHeader({ title, subtitle, showBack, onBack }: { title: string; subtitle: string; showBack: boolean; onBack: () => void }) {
  return (
    <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-stone-200 bg-[#fbfaf6] px-3">
      {showBack ? (
        <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-md border border-stone-200 bg-white">
          <ChevronLeft size={20} />
        </button>
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-800 text-white">
          <Spade size={19} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-bold text-emerald-800">{subtitle}</div>
        <h1 className="truncate text-lg font-black">{title}</h1>
      </div>
    </header>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [heroName, setHeroName] = useState("");

  async function save() {
    if (!heroName.trim()) return;
    const time = nowIso();
    await db.userProfiles.add({ id: uid(), heroName: heroName.trim(), createdAt: time, updatedAt: time });
    onDone();
  }

  return (
    <main className="grid h-dvh place-items-center bg-[#f2eee5] px-4 text-stone-950">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-black">初回登録</h1>
        <p className="mt-1 text-sm text-stone-600">Hero名は最初に固定します。</p>
        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-bold">Hero名</span>
          <input value={heroName} onChange={(event) => setHeroName(event.target.value)} className="h-11 w-full rounded-md border border-stone-300 px-3" />
        </label>
        <button type="button" onClick={save} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-800 font-bold text-white">
          <Save size={16} />保存
        </button>
      </section>
    </main>
  );
}

function HomeScreen({
  session,
  games,
  profile,
  onOpenSession,
  onNewSession,
  onExport,
  onHistory,
}: {
  session?: Session;
  games: Hand[];
  profile: UserProfile;
  onOpenSession: () => void;
  onNewSession: () => void;
  onExport: () => void;
  onHistory: () => void;
}) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-3 py-3">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-stone-500">Hero</div>
        <div className="mt-1 text-2xl font-black">{profile.heroName}</div>
      </section>
      <section className="grid min-h-0 grid-cols-2 gap-3">
        <button type="button" onClick={onOpenSession} className="rounded-lg bg-emerald-800 p-4 text-left text-white shadow-sm">
          <Home size={22} />
          <div className="mt-4 text-lg font-black">{session ? "進行中へ戻る" : "セッション作成"}</div>
          <div className="mt-1 text-sm text-emerald-50">{session ? `${session.venueName} / ${games.length}ゲーム` : "最初の卓を作成"}</div>
        </button>
        <button type="button" onClick={onNewSession} className="rounded-lg border border-stone-200 bg-white p-4 text-left shadow-sm">
          <Plus size={22} />
          <div className="mt-4 text-lg font-black">新しいセッション</div>
          <div className="mt-1 text-sm text-stone-500">ホームから開始</div>
        </button>
        <button type="button" onClick={onExport} disabled={!session} className="rounded-lg border border-stone-200 bg-white p-4 text-left shadow-sm disabled:opacity-40">
          <FileText size={22} />
          <div className="mt-4 text-lg font-black">AI出力</div>
          <div className="mt-1 text-sm text-stone-500">Markdownコピー</div>
        </button>
        <button type="button" onClick={onHistory} className="rounded-lg border border-stone-200 bg-white p-4 text-left shadow-sm">
          <Cloud size={22} />
          <div className="mt-4 text-lg font-black">過去セッション</div>
          <div className="mt-1 text-sm text-stone-500">閲覧・クラウド編集</div>
        </button>
      </section>
      <section className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-600 shadow-sm">
        基本は画面全体をスクロールせず、必要な入力だけシートで開きます。
      </section>
    </div>
  );
}

function SessionForm({
  profile,
  playUnits,
  venues,
  savedRates,
  onDone,
}: {
  profile: UserProfile;
  playUnits: PlayUnit[];
  venues: Venue[];
  savedRates: SavedRate[];
  onDone: (sessionId: string) => void;
}) {
  const [country, setCountry] = useState("韓国");
  const [customCountry, setCustomCountry] = useState("");
  const [venueName, setVenueName] = useState("");
  const [playUnitId, setPlayUnitId] = useState(playUnits[0]?.id || "");
  const [customUnit, setCustomUnit] = useState("");
  const [sb, setSb] = useState("1000");
  const [bb, setBb] = useState("3000");
  const [inputUnit, setInputUnit] = useState("1000");
  const [rakePercent, setRakePercent] = useState("5");
  const [rakeCapBb, setRakeCapBb] = useState("5");
  const [memo, setMemo] = useState("");
  const [sheet, setSheet] = useState<SheetMode>(null);

  async function save() {
    const time = nowIso();
    const finalCountry = country === "その他" ? customCountry.trim() : country;
    if (!finalCountry || !venueName.trim()) return;

    let unit = playUnits.find((item) => item.id === playUnitId);
    if (playUnitId === "other" && customUnit.trim()) {
      unit = { id: uid(), name: customUnit.trim(), type: "amusement_point", country: finalCountry, isDefault: false, createdByUserId: profile.id, createdAt: time };
      await db.playUnits.add(unit);
    }
    if (!unit) return;

    let venue = venues.find((item) => item.name === venueName.trim() && item.country === finalCountry);
    if (!venue) {
      venue = { id: uid(), country: finalCountry, name: venueName.trim(), type: finalCountry === "日本" ? "amusement" : "casino", lastUsedAt: time, createdAt: time };
      await db.venues.add(venue);
    } else {
      await db.venues.update(venue.id, { lastUsedAt: time });
    }

    const smallBlindAmount = Number(sb) || 0;
    const bigBlindAmount = Number(bb) || 1;
    const amountInputUnit = Number(inputUnit) || 1;
    const rateLabel = `${smallBlindAmount.toLocaleString()}-${bigBlindAmount.toLocaleString()}`;
    const id = uid();
    await db.sessions.add({
      id,
      date: new Date().toISOString().slice(0, 10),
      country: finalCountry,
      venueId: venue.id,
      venueName: venue.name,
      playUnitId: unit.id,
      playUnitName: unit.name,
      rateLabel,
      smallBlindAmount,
      bigBlindAmount,
      amountInputUnit,
      rakePercent: Number(rakePercent) || 0,
      rakeCapBb: Number(rakeCapBb) || 0,
      memo,
      syncStatus: "local_draft",
      createdAt: time,
      updatedAt: time,
    });

    await db.savedRates.add({ id: uid(), venueId: venue.id, playUnitId: unit.id, label: rateLabel, smallBlindAmount, bigBlindAmount, amountInputUnit, lastUsedAt: time });

    onDone(id);
  }

  return (
    <div className="grid h-full grid-rows-[1fr_auto] gap-3 py-3">
      <section className="grid min-h-0 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <h2 className="text-base font-black">基本情報</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="国">
              <select value={country} onChange={(event) => setCountry(event.target.value)} className="input">
                {COUNTRIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label={country === "その他" ? "国名" : "店舗"}>
              {country === "その他" ? (
                <input value={customCountry} onChange={(event) => setCustomCountry(event.target.value)} className="input" />
              ) : (
                <input list="venues" value={venueName} onChange={(event) => setVenueName(event.target.value)} className="input" />
              )}
              <datalist id="venues">{venues.map((venue) => <option key={venue.id} value={venue.name} />)}</datalist>
            </Field>
            <Field label="プレイ単位">
              <select value={playUnitId} onChange={(event) => setPlayUnitId(event.target.value)} className="input">
                {playUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                <option value="other">その他</option>
              </select>
            </Field>
            <Field label={playUnitId === "other" ? "単位名" : "レート名"}>
              {playUnitId === "other" ? (
                <input value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} className="input" />
              ) : (
                <div className="grid h-10 place-items-center rounded-md border border-stone-200 bg-stone-50 text-sm font-black">
                  {(Number(sb) || 0).toLocaleString()}-{(Number(bb) || 0).toLocaleString()}
                </div>
              )}
            </Field>
          </div>
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="セッションメモ" className="mt-3 h-20 w-full resize-none rounded-md border border-stone-300 p-2 text-sm" />
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black">レート</h2>
            <button type="button" onClick={() => setSheet("rake")} className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-200 px-2 text-xs font-bold">
              <Settings2 size={14} />レーキ
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="レート名"><div className="grid h-10 place-items-center rounded-md border border-stone-200 bg-stone-50 text-sm font-black">{(Number(sb) || 0).toLocaleString()}-{(Number(bb) || 0).toLocaleString()}</div></Field>
            <Field label="省略単位"><input value={inputUnit} onChange={(event) => setInputUnit(event.target.value)} className="input" inputMode="numeric" /></Field>
            <Field label="SB額"><input value={sb} onChange={(event) => setSb(event.target.value)} className="input" inputMode="numeric" /></Field>
            <Field label="BB額"><input value={bb} onChange={(event) => setBb(event.target.value)} className="input" inputMode="numeric" /></Field>
          </div>
          <div className="mt-3 grid max-h-28 gap-2 overflow-auto">
            {savedRates.slice(0, 4).map((rate) => (
              <button key={rate.id} type="button" onClick={() => {
                setSb(String(rate.smallBlindAmount));
                setBb(String(rate.bigBlindAmount));
                setInputUnit(String(rate.amountInputUnit));
              }} className="rounded-md border border-stone-200 px-3 py-2 text-left text-xs">
                <b>{rate.label}</b> / 省略 {rate.amountInputUnit.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </section>
      <button type="button" onClick={save} className="h-12 rounded-md bg-emerald-800 font-black text-white">セッション開始</button>
      <BottomSheet title="レーキ設定" open={sheet === "rake"} onClose={() => setSheet(null)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="レーキ%"><input value={rakePercent} onChange={(event) => setRakePercent(event.target.value)} className="input" inputMode="decimal" /></Field>
          <Field label="上限BB"><input value={rakeCapBb} onChange={(event) => setRakeCapBb(event.target.value)} className="input" inputMode="decimal" /></Field>
        </div>
      </BottomSheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-stone-600">{label}</span>
      {children}
    </label>
  );
}

function TableScreen({
  session,
  profile,
  players,
  roster,
  games,
  playerProfiles,
  onRefresh,
  onGame,
  onGameHistory,
  onHome,
}: {
  session: Session;
  profile: UserProfile;
  players: SessionPlayer[];
  roster: SessionPlayer[];
  games: Hand[];
  playerProfiles: PlayerProfile[];
  onRefresh: () => void;
  onGame: () => void;
  onGameHistory: () => void;
  onHome: () => void;
}) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [tendencyPlayer, setTendencyPlayer] = useState<SessionPlayer | null>(null);

  return (
    <div className="grid h-full grid-rows-[1fr_auto] gap-3 py-3">
      <section className="min-h-0 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">卓</h2>
            <p className="text-xs text-stone-500">{session.country} / {session.playUnitName} / {games.length}ゲーム</p>
          </div>
          <div className="text-right text-xs font-bold text-stone-600">同期: {syncLabel(session.syncStatus)}</div>
        </div>
        <PokerTable
          players={players}
          games={games}
          session={session}
          onSeatClick={(seat) => setSelectedSeat(seat)}
          onTendency={(player) => setTendencyPlayer(player)}
        />
      </section>
      <nav className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onHome} className="bottom-btn bg-white text-stone-900"><Home size={17} />ホーム</button>
        <button type="button" onClick={onGameHistory} className="bottom-btn bg-white text-stone-900"><Layers size={17} />履歴</button>
        <button type="button" onClick={onGame} className="bottom-btn bg-emerald-800 text-white"><Plus size={17} />ゲーム追加</button>
      </nav>
      {selectedSeat && (
        <PlayerSheet
          session={session}
          profile={profile}
          seat={selectedSeat}
          players={players}
          roster={roster}
          nextGameNumber={games.length + 1}
          playerProfiles={playerProfiles}
          onClose={() => setSelectedSeat(null)}
          onDone={async () => {
            setSelectedSeat(null);
            onRefresh();
          }}
        />
      )}
      {tendencyPlayer && (
        <TendencySheet
          player={tendencyPlayer}
          onClose={() => setTendencyPlayer(null)}
          onDone={async () => {
            setTendencyPlayer(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function PokerTable({
  players,
  games,
  session,
  buttonSeat,
  activeSeats = [],
  actionLabelsBySeat,
  onSeatClick,
  onTendency,
}: {
  players: SessionPlayer[];
  games?: Hand[];
  session?: Session;
  buttonSeat?: number;
  activeSeats?: number[];
  actionLabelsBySeat?: Record<number, string>;
  onSeatClick?: (seat: number, player?: SessionPlayer) => void;
  onTendency?: (player: SessionPlayer) => void;
}) {
  const bySeat = seatPlayerMap(players);
  const blinds = deriveButtonBlindSeats(players, buttonSeat);
  return (
    <div className="relative mx-auto mt-2 h-[min(62dvh,520px)] min-h-[380px] max-w-[760px]">
      <div className="absolute left-[12%] top-[18%] h-[64%] w-[76%] rounded-[48%] border-[12px] border-emerald-950 bg-emerald-700 shadow-inner" />
      <div className="absolute left-1/2 top-1/2 w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-800/70 py-5 text-center text-white">
        <div className="text-xs font-bold">POKER TABLE</div>
        {session && <div className="text-sm font-black">{session.rateLabel}</div>}
      </div>
      {SEATS.map((seat) => {
        const player = bySeat.get(seat);
        const stats = player && games && session ? summarizePlayerStats(player, games, session.bigBlindAmount) : undefined;
        const badge = blinds.buttonSeat === seat ? "BTN" : blinds.sbSeat === seat ? "SB" : blinds.bbSeat === seat ? "BB" : "";
        return (
          <button
            key={seat}
            type="button"
            onClick={() => onSeatClick?.(seat, player)}
            className={`absolute ${seatPositions[seat]} w-[72px] rounded-lg border p-1.5 text-left shadow-sm transition sm:w-[92px] sm:p-2 ${
              activeSeats.includes(seat) ? "border-amber-300 bg-amber-100" : player ? "border-stone-300 bg-white" : "border-stone-200 bg-white/80"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-black sm:text-xs">Seat{seat}</span>
              {badge && <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-black text-white">{badge}</span>}
            </div>
            <div className="mt-1 h-5 truncate text-xs font-black sm:text-sm">{player?.displayName || ""}</div>
            <div className="h-4 truncate text-[10px] text-stone-500">
              {actionLabelsBySeat?.[seat] || (stats ? `関与${stats.involvedHands} SD${stats.showdownsSeen}` : "")}
            </div>
            {player && onTendency && (
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  onTendency(player);
                }}
                className="mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600"
              >
                傾向
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlayerSheet({
  session,
  profile,
  seat,
  players,
  roster,
  nextGameNumber,
  playerProfiles,
  onClose,
  onDone,
}: {
  session: Session;
  profile: UserProfile;
  seat: number;
  players: SessionPlayer[];
  roster: SessionPlayer[];
  nextGameNumber: number;
  playerProfiles: PlayerProfile[];
  onClose: () => void;
  onDone: () => void;
}) {
  const existing = players.find((player) => player.seatNumber === seat);
  const [selectedSeat, setSelectedSeat] = useState(String(seat));
  const [mode, setMode] = useState<"edit" | "hero" | "new" | "past">(existing ? "edit" : "hero");
  const [nickname, setNickname] = useState(existing?.displayName || "");
  const [query, setQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(existing?.playerProfileId || "");
  const [notes, setNotes] = useState(existing?.sessionNotes || "");
  const [error, setError] = useState("");
  const usedSeats = new Set(players.filter((player) => player.id !== existing?.id).map((player) => player.seatNumber));
  const matches = playerProfiles
    .filter((profile) => profile.nickname.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  const hasActiveHero = players.some((player) => player.isHero && player.id !== existing?.id);

  async function save() {
    const time = nowIso();
    const nextSeat = Number(selectedSeat);
    const selectedProfile = playerProfiles.find((item) => item.id === selectedProfileId);
    const finalName = mode === "hero" ? profile.heroName : mode === "past" ? selectedProfile?.nickname || "" : nickname.trim();
    if (!finalName) return setError(mode === "past" ? "過去プレイヤーを選択してください。" : "ニックネームを入力してください。");
    if (mode === "hero" && hasActiveHero) return setError("Heroはこのセッションで既に登録されています。");
    if (usedSeats.has(nextSeat)) return setError("そのSeatは使用中です。");
    if (roster.some((player) => player.id !== existing?.id && player.displayName === finalName)) return setError("このセッション内で同じ名前は使えません。");

    let playerProfile = mode === "hero" ? playerProfiles.find((item) => item.nickname === profile.heroName) : selectedProfile;
    const exactProfile = playerProfiles.find((item) => item.nickname === finalName);
    if (mode !== "edit" && mode !== "hero" && !playerProfile && exactProfile) return setError("同じ名前の過去プレイヤーがあります。検索結果から選択してください。");
    if (mode === "edit" && exactProfile && exactProfile.id !== existing?.playerProfileId) return setError("同じ名前の別プレイヤーが登録済みです。");
    if (!playerProfile) {
      if (existing?.playerProfileId) {
        playerProfile = playerProfiles.find((item) => item.id === existing.playerProfileId);
        if (playerProfile) await db.playerProfiles.update(playerProfile.id, { nickname: finalName, updatedAt: time });
      }
      if (!playerProfile) {
        playerProfile = { id: uid(), nickname: finalName, aliases: mode === "hero" ? ["Hero"] : [], tendencies: {}, createdAt: time, updatedAt: time };
        await db.playerProfiles.add(playerProfile);
      }
    } else if (mode === "edit" && playerProfile.nickname !== finalName) {
      await db.playerProfiles.update(playerProfile.id, { nickname: finalName, updatedAt: time });
    }

    if (existing) {
      const history = existing.seatNumber === nextSeat
        ? existing.seatHistory
        : [
            ...existing.seatHistory.map((item) => item.isCurrent ? { ...item, isCurrent: false, endedAtHandNumber: undefined } : item),
            { id: uid(), seatNumber: nextSeat, isCurrent: true },
          ];
      await db.sessionPlayers.update(existing.id, {
        playerProfileId: playerProfile.id,
        displayName: finalName,
        seatNumber: nextSeat,
        isActive: true,
        sessionNotes: notes,
        seatHistory: history,
        updatedAt: time,
      });
    } else {
      await db.sessionPlayers.add({
        id: uid(),
        sessionId: session.id,
        playerProfileId: playerProfile.id,
        displayName: finalName,
        seatNumber: nextSeat,
        isHero: mode === "hero",
        isActive: true,
        joinedAtGameNumber: nextGameNumber,
        sessionNotes: notes,
        sessionTendencies: {},
        seatHistory: [{ id: uid(), seatNumber: nextSeat, isCurrent: true }],
        createdAt: time,
        updatedAt: time,
      });
    }
    onDone();
  }

  async function leaveSeat() {
    if (!existing || existing.isHero) return;
    const time = nowIso();
    await db.sessionPlayers.update(existing.id, {
      isActive: false,
      leftAtGameNumber: nextGameNumber,
      leftAt: time,
      updatedAt: time,
      seatHistory: existing.seatHistory.map((item) => item.isCurrent ? { ...item, isCurrent: false, endedAtHandNumber: nextGameNumber } : item),
    });
    onDone();
  }

  return (
    <BottomSheet title={`Seat${seat} プレイヤー`} open onClose={onClose}>
      <div className="grid gap-3">
        <div className="grid grid-cols-9 gap-1">
          {SEATS.map((item) => (
            <button key={item} type="button" disabled={usedSeats.has(item)} onClick={() => setSelectedSeat(String(item))} className={`h-9 rounded-md border text-sm font-black disabled:opacity-30 ${selectedSeat === String(item) ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
              {item}
            </button>
          ))}
        </div>
        {!existing && (
          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={hasActiveHero} onClick={() => {
              setMode("hero");
              setSelectedProfileId("");
              setError("");
            }} className={`h-10 rounded-md border text-sm font-black disabled:opacity-35 ${mode === "hero" ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
              Hero登録
            </button>
            <button type="button" onClick={() => {
              setMode("new");
              setSelectedProfileId("");
              setError("");
            }} className={`h-10 rounded-md border text-sm font-black ${mode === "new" ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
              新規登録
            </button>
            <button type="button" onClick={() => {
              setMode("past");
              setError("");
            }} className={`h-10 rounded-md border text-sm font-black ${mode === "past" ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
              過去から検索
            </button>
          </div>
        )}
        {mode === "hero" ? (
          <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
            Hero名: {profile.heroName}
          </div>
        ) : mode === "new" || mode === "edit" ? (
          <Field label={mode === "edit" ? "ニックネーム変更" : "ニックネーム"}>
            <input value={nickname} onChange={(event) => {
              setNickname(event.target.value);
              setError("");
            }} className="input" />
          </Field>
        ) : (
          <Field label="過去プレイヤー検索">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-stone-400" size={15} />
              <input value={query} onChange={(event) => {
                setQuery(event.target.value);
                setSelectedProfileId("");
                setError("");
              }} className="input pl-9" />
            </div>
          </Field>
        )}
        {mode === "past" && matches.length > 0 && (
          <div className="max-h-28 overflow-auto rounded-md border border-stone-200">
            {matches.map((profile) => (
              <button key={profile.id} type="button" onClick={() => {
                setSelectedProfileId(profile.id);
                setNickname(profile.nickname);
                setError("");
              }} className={`block w-full px-3 py-2 text-left text-sm ${selectedProfileId === profile.id ? "bg-emerald-50 font-bold" : "bg-white"}`}>
                {profile.nickname}
              </button>
            ))}
          </div>
        )}
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="セッション内メモ" className="h-20 resize-none rounded-md border border-stone-300 p-2 text-sm" />
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
        <div className={`grid gap-2 ${existing && !existing.isHero ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={save} className="h-11 rounded-md bg-emerald-800 font-black text-white">{existing ? "変更を保存" : "保存"}</button>
          {existing && !existing.isHero && (
            <button type="button" onClick={leaveSeat} className="h-11 rounded-md border border-red-200 bg-red-50 font-black text-red-700">離席</button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function TendencySheet({ player, onClose, onDone }: { player: SessionPlayer; onClose: () => void; onDone: () => void }) {
  async function update(key: keyof PlayerTendencies, value: string) {
    await db.sessionPlayers.update(player.id, { sessionTendencies: { ...player.sessionTendencies, [key]: value }, updatedAt: nowIso() });
    onDone();
  }

  return (
    <BottomSheet title={`${player.displayName} 傾向`} open onClose={onClose}>
      <div className="max-h-[48dvh] space-y-3 overflow-auto pr-1">
        {(Object.keys(TENDENCY_LABELS) as (keyof PlayerTendencies)[]).map((key) => (
          <div key={key}>
            <div className="mb-1 text-xs font-black text-stone-600">{TENDENCY_LABELS[key]}</div>
            <div className="flex flex-wrap gap-2">
              {TENDENCY_OPTIONS[key].map((option) => (
                <button key={option} type="button" onClick={() => update(key, option)} className={`h-8 rounded-md border px-2 text-xs font-bold ${player.sessionTendencies[key] === option ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// Kept temporarily as a fallback while the simplified notation input settles.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GameInput({ session, players, games, onDone }: { session: Session; players: SessionPlayer[]; games: Hand[]; onDone: () => void }) {
  const [step, setStep] = useState<GameStep>("button");
  const [buttonSeat, setButtonSeat] = useState(players[0]?.seatNumber || 1);
  const [actions, setActions] = useState<HandAction[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [amountTarget, setAmountTarget] = useState<{ actionType: ActionType; playerId: string; street: Street } | null>(null);
  const [amountValue, setAmountValue] = useState("");
  const [cardTarget, setCardTarget] = useState<{ label: string; max: number; cards: string[]; setCards: (cards: string[]) => void } | null>(null);
  const [flop, setFlop] = useState<string[]>([]);
  const [turn, setTurn] = useState<string[]>([]);
  const [river, setRiver] = useState<string[]>([]);
  const [showdownStatus, setShowdownStatus] = useState<Record<string, ShowdownStatus>>({});
  const [showdownCards, setShowdownCards] = useState<Record<string, string[]>>({});
  const [resultText, setResultText] = useState("");
  const [movedBb, setMovedBb] = useState("");
  const [memo, setMemo] = useState("");

  const activeStreet = stepToStreet(step);
  const bySeat = seatPlayerMap(players);
  const seatsForStreet = useMemo(() => {
    if (!activeStreet) return [];
    const base = orderedActionSeats(players, buttonSeat, activeStreet);
    const inactive = inactiveSeatSet(actions, activeStreet, players);
    return base.filter((seat) => !inactive.has(seat));
  }, [actions, activeStreet, buttonSeat, players]);
  const actionLabelsBySeat = useMemo(() => {
    const labels: Record<number, string> = {};
    actions.forEach((action) => {
      const player = players.find((item) => item.id === action.actorSessionPlayerId);
      if (!player) return;
      const amount = action.amount ? ` ${formatBb(action.amount, session.bigBlindAmount)}` : "";
      labels[player.seatNumber] = `${labels[player.seatNumber] ? `${labels[player.seatNumber]} / ` : ""}${actionLabels[action.actionType]}${amount}`;
    });
    return labels;
  }, [actions, players, session.bigBlindAmount]);
  const usedCards = [...flop, ...turn, ...river, ...Object.values(showdownCards).flat()];

  function addAction(actionType: ActionType, player?: SessionPlayer) {
    if (!activeStreet || !player) return;
    if (actionType === "bet_raise" || actionType === "allin") {
      setAmountTarget({ actionType, playerId: player.id, street: activeStreet });
      return;
    }
    setActions((current) => [...current, { id: uid(), street: activeStreet, actorSessionPlayerId: player.id, actionType, order: current.length + 1 }]);
  }

  function addAmountAction() {
    if (!amountTarget) return;
    setActions((current) => [
      ...current,
      {
        id: uid(),
        street: amountTarget.street,
        actorSessionPlayerId: amountTarget.playerId,
        actionType: amountTarget.actionType,
        amount: parseAmount(amountValue, session.amountInputUnit),
        order: current.length + 1,
      },
    ]);
    setAmountTarget(null);
    setAmountValue("");
  }

  async function saveGame() {
    const time = nowIso();
    const blinds = deriveButtonBlindSeats(players, buttonSeat);
    const participants: HandParticipant[] = players.map((player) => {
      const position = blinds.buttonSeat === player.seatNumber ? "BTN" : blinds.sbSeat === player.seatNumber ? "SB" : blinds.bbSeat === player.seatNumber ? "BB" : undefined;
      return {
        id: uid(),
        sessionPlayerId: player.id,
        displayName: player.displayName,
        isHero: player.isHero,
        seatNumber: player.seatNumber,
        position: position as Position | undefined,
        holeCards: showdownCards[player.id] || [],
        showdownStatus: showdownStatus[player.id] || "unknown",
        showdownCards: showdownCards[player.id] || [],
      };
    });
    const potAmount = estimatePot(actions);
    await db.hands.add({
      id: uid(),
      sessionId: session.id,
      handNumber: games.length + 1,
      participants,
      board: { flop, turn: turn[0], river: river[0] },
      actions,
      potAmount,
      rakeAmount: estimateRake(potAmount, session),
      resultText,
      movedBb: movedBb ? Number(movedBb) : amountToBb(potAmount, session.bigBlindAmount),
      memo,
      createdAt: time,
      updatedAt: time,
    });
    await db.sessions.update(session.id, { updatedAt: time, syncStatus: session.syncStatus === "synced_readonly" ? "synced_readonly" : "local_draft" });
    onDone();
  }

  if (session.syncStatus === "synced_readonly") {
    return <ReadonlyNotice />;
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-2 py-2">
      <GameStepHeader step={step} gameNumber={games.length + 1} board={[...flop, ...turn, ...river]} />
      <section className="min-h-0 rounded-lg border border-stone-200 bg-white p-2 shadow-sm">
        <PokerTable
          players={players}
          buttonSeat={buttonSeat}
          activeSeats={step === "button" ? [buttonSeat] : seatsForStreet}
          actionLabelsBySeat={actionLabelsBySeat}
          onSeatClick={(seat, player) => {
            if (step === "button" && player) setButtonSeat(seat);
            setSelectedSeat(seat);
          }}
        />
      </section>
      <GameControlBar
        step={step}
        selectedPlayer={selectedSeat ? bySeat.get(selectedSeat) : undefined}
        canPickCard={["flop-card", "turn-card", "river-card"].includes(step)}
        onCard={() => {
          if (step === "flop-card") setCardTarget({ label: "フロップ", max: 3, cards: flop, setCards: setFlop });
          if (step === "turn-card") setCardTarget({ label: "ターン", max: 1, cards: turn, setCards: setTurn });
          if (step === "river-card") setCardTarget({ label: "リバー", max: 1, cards: river, setCards: setRiver });
        }}
        onAction={addAction}
        onNext={() => {
          const next = nextStep[step];
          if (next) setStep(next);
        }}
        onSave={saveGame}
      />

      {step === "showdown" && (
        <BottomSheet title="Showdown" open onClose={() => setStep("result")}>
          <div className="grid max-h-[52dvh] gap-2 overflow-auto">
            {players.map((player) => (
              <div key={player.id} className="rounded-md border border-stone-200 p-2">
                <div className="mb-2 text-sm font-black">Seat{player.seatNumber} {player.displayName}</div>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ["shown", "ショー"],
                    ["mucked", "マック"],
                    ["unknown", "不明"],
                  ] as [ShowdownStatus, string][]).map(([status, label]) => (
                    <button key={status} type="button" onClick={() => setShowdownStatus((current) => ({ ...current, [player.id]: status }))} className={`h-9 rounded-md border text-xs font-black ${(showdownStatus[player.id] || "unknown") === status ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
                      {label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setCardTarget({ label: `${player.displayName} カード`, max: 2, cards: showdownCards[player.id] || [], setCards: (cards) => setShowdownCards((current) => ({ ...current, [player.id]: cards })) })} className="h-9 rounded-md border border-stone-200 text-xs font-black">
                    {showdownCards[player.id]?.join(" ") || "カード"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setStep("result")} className="mt-3 h-11 w-full rounded-md bg-emerald-800 font-black text-white">結果へ</button>
        </BottomSheet>
      )}

      {step === "result" && (
        <BottomSheet title="結果" open onClose={() => setStep("river")}>
          <div className="grid gap-3">
            <Field label="結果メモ"><input value={resultText} onChange={(event) => setResultText(event.target.value)} className="input" /></Field>
            <Field label="動いたBB"><input value={movedBb} onChange={(event) => setMovedBb(event.target.value)} className="input" inputMode="decimal" /></Field>
            <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="一言メモ" className="h-20 resize-none rounded-md border border-stone-300 p-2 text-sm" />
            <div className="rounded-md bg-stone-50 p-2 text-xs text-stone-600">ポット概算: {formatAmount(estimatePot(actions), session.playUnitName)} / レーキ: {formatAmount(estimateRake(estimatePot(actions), session), session.playUnitName)}</div>
            <button type="button" onClick={saveGame} className="h-11 rounded-md bg-emerald-800 font-black text-white">ゲーム保存</button>
          </div>
        </BottomSheet>
      )}

      <BottomSheet title={`${amountTarget ? actionLabels[amountTarget.actionType] : ""} 額`} open={!!amountTarget} onClose={() => setAmountTarget(null)}>
        <AmountInput label="省略入力" value={amountValue} session={session} onChange={setAmountValue} />
        <button type="button" onClick={addAmountAction} className="mt-3 h-11 w-full rounded-md bg-emerald-800 font-black text-white">追加</button>
      </BottomSheet>
      <BottomSheet title={cardTarget?.label || "カード"} open={!!cardTarget} onClose={() => setCardTarget(null)}>
        {cardTarget && (
          <CardPicker cards={cardTarget.cards} max={cardTarget.max} usedCards={usedCards.filter((card) => !cardTarget.cards.includes(card))} onChange={cardTarget.setCards} />
        )}
      </BottomSheet>
    </div>
  );
}

function stepToStreet(step: GameStep): Street | null {
  if (["preflop", "flop", "turn", "river"].includes(step)) return step as Street;
  return null;
}

function inactiveSeatSet(actions: HandAction[], street: Street, players: SessionPlayer[]) {
  const order: Street[] = ["preflop", "flop", "turn", "river"];
  const targetIndex = order.indexOf(street);
  const inactiveIds = new Set<string>();
  actions.filter((action) => order.indexOf(action.street) < targetIndex).forEach((action) => {
    if (action.actionType === "fold" || action.actionType === "allin") inactiveIds.add(action.actorSessionPlayerId);
  });
  return new Set(players.filter((player) => inactiveIds.has(player.id)).map((player) => player.seatNumber));
}

function GameStepHeader({ step, gameNumber, board }: { step: GameStep; gameNumber: number; board: string[] }) {
  const label: Record<GameStep, string> = {
    button: "BTN選択",
    preflop: "プリフロップ",
    "flop-card": "フロップカード",
    flop: "フロップ",
    "turn-card": "ターンカード",
    turn: "ターン",
    "river-card": "リバーカード",
    river: "リバー",
    showdown: "Showdown",
    result: "結果",
  };
  return (
    <div className="flex h-12 items-center justify-between rounded-lg border border-stone-200 bg-white px-3 shadow-sm">
      <div className="font-black">Game {gameNumber} / {label[step]}</div>
      <div className="truncate text-sm font-bold text-stone-600">Board: {board.join(" ") || "-"}</div>
    </div>
  );
}

function GameControlBar({
  step,
  selectedPlayer,
  canPickCard,
  onCard,
  onAction,
  onNext,
  onSave,
}: {
  step: GameStep;
  selectedPlayer?: SessionPlayer;
  canPickCard: boolean;
  onCard: () => void;
  onAction: (actionType: ActionType, player?: SessionPlayer) => void;
  onNext: () => void;
  onSave: () => void;
}) {
  if (step === "button") {
    return <button type="button" onClick={onNext} className="h-12 rounded-md bg-emerald-800 font-black text-white">プリフロップへ</button>;
  }
  if (canPickCard) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCard} className="h-12 rounded-md border border-stone-200 bg-white font-black">カード選択</button>
        <button type="button" onClick={onNext} className="h-12 rounded-md bg-emerald-800 font-black text-white">次へ</button>
      </div>
    );
  }
  if (step === "result") {
    return <button type="button" onClick={onSave} className="h-12 rounded-md bg-emerald-800 font-black text-white">ゲーム保存</button>;
  }
  return (
    <div className="grid grid-cols-6 gap-1">
      {(["fold", "check", "call", "bet_raise", "allin"] as ActionType[]).map((type) => (
        <button key={type} type="button" onClick={() => onAction(type, selectedPlayer)} disabled={!selectedPlayer} className="h-12 rounded-md border border-stone-200 bg-white text-[11px] font-black disabled:opacity-35">
          {type === "bet_raise" ? "レイズ" : actionLabels[type]}
        </button>
      ))}
      <button type="button" onClick={onNext} className="h-12 rounded-md bg-emerald-800 text-xs font-black text-white">次へ</button>
    </div>
  );
}

function SimpleGameInput({ session, players, games, onDone }: { session: Session; players: SessionPlayer[]; games: Hand[]; onDone: () => void }) {
  const activePlayers = activeSessionPlayers(players);
  const [buttonSeat, setButtonSeat] = useState(activePlayers[0]?.seatNumber || 1);
  const [activeStreet, setActiveStreet] = useState<Street>("preflop");
  const [actionTarget, setActionTarget] = useState<{ playerId: string; street: Street } | null>(null);
  const [actions, setActions] = useState<HandAction[]>([]);
  const [flop, setFlop] = useState<string[]>([]);
  const [turn, setTurn] = useState<string[]>([]);
  const [river, setRiver] = useState<string[]>([]);
  const [potByStreet, setPotByStreet] = useState<Record<Street, string>>({ preflop: "", flop: "", turn: "", river: "", showdown: "" });
  const [showdownStatus, setShowdownStatus] = useState<Record<string, ShowdownStatus>>({});
  const [showdownCards, setShowdownCards] = useState<Record<string, string[]>>({});
  const [cardTarget, setCardTarget] = useState<{ label: string; max: number; cards: string[]; setCards: (cards: string[]) => void; onComplete?: () => void } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [winnerId, setWinnerId] = useState("");
  const [resultText, setResultText] = useState("");
  const [memo, setMemo] = useState("");

  const positionMap = derivePositionsByButton(activePlayers, buttonSeat);
  const orderedPlayers = positionedPlayers(activePlayers, buttonSeat);
  const blinds = deriveButtonBlindSeats(activePlayers, buttonSeat);
  const preflopOrder = orderedPreflopPlayers(activePlayers, buttonSeat);
  const usedCards = [...flop, ...turn, ...river, ...Object.values(showdownCards).flat()];
  const livePlayers = orderedPlayers.filter((player) => !hasFoldedBeforeStreet(player.id, actions, "showdown"));
  const currentFinalActions = [
    ...blindActions(activePlayers, blinds, session),
    ...visibleActions("preflop"),
    ...actions.filter((action) => action.street !== "preflop"),
  ].map((action, index) => ({ ...action, order: index + 1 }));
  const currentPotAmount = estimatePot(currentFinalActions);
  const currentRakeAmount = estimateRake(currentPotAmount, session);
  const winnerAmount = Math.max(0, currentPotAmount - currentRakeAmount);

  function visibleActions(street: Street) {
    return actions.filter((action) => action.street === street).sort((a, b) => a.order - b.order);
  }

  function playersForStreet(street: Street) {
    const base = street === "preflop" ? preflopOrder : orderedPostflopPlayers(activePlayers, buttonSeat);
    return base.filter((player) => !hasFoldedBeforeStreet(player.id, actions, street) && !isAllInBeforeStreet(player.id, actions, street));
  }

  function actionRowsForStreet(street: Street) {
    const base = playersForStreet(street).map((player) => ({ player, repeat: false }));
    const streetActions = actions.filter((action) => action.street === street);
    const latestRaise = [...streetActions].reverse().find((action) => action.actionType === "bet_raise" || action.actionType === "allin");
    if (!latestRaise) return base;

    const latestByPlayer = new Map<string, HandAction>();
    streetActions.forEach((action) => latestByPlayer.set(action.actorSessionPlayerId, action));
    const repeatPlayers = playersForStreet(street).filter((player) => {
      if (player.id === latestRaise.actorSessionPlayerId) return false;
      const latest = latestByPlayer.get(player.id);
      if (latest?.actionType === "fold" || latest?.actionType === "allin") return false;
      return !latest || latest.order < latestRaise.order;
    });
    return [...base, ...repeatPlayers.map((player) => ({ player, repeat: true }))];
  }

  function addAction(player: SessionPlayer, actionType: ActionType, amountInput = "", street = activeStreet) {
    const orderPlayers = playersForStreet(street);
    const playerIndex = orderPlayers.findIndex((item) => item.id === player.id);
    const streetRank = ["preflop", "flop", "turn", "river", "showdown"] as Street[];
    const streetIndex = streetRank.indexOf(street);
    const prunedActions = actions.filter((action) => {
      const actionStreetIndex = streetRank.indexOf(action.street);
      if (actionStreetIndex > streetIndex) return false;
      if (action.street !== street) return true;
      const actorIndex = orderPlayers.findIndex((item) => item.id === action.actorSessionPlayerId);
      return actorIndex !== -1 && actorIndex < playerIndex;
    });
    const autoFoldActions = skippedPlayersForAction(orderPlayers, prunedActions, street, player.id, actionType, session, blinds).map((skippedPlayer, index) => ({
      id: uid(),
      street,
      actorSessionPlayerId: skippedPlayer.id,
      actionType: "fold" as ActionType,
      note: "[AUTO] Fold",
      order: prunedActions.length + index + 1,
    }));
    const stateBeforeAction = streetState([...blindActions(activePlayers, blinds, session), ...prunedActions, ...autoFoldActions], street, session, blinds);
    const currentContribution = stateBeforeAction.contributions.get(player.id) || 0;
    const targetAmount = parseAmount(amountInput, session.amountInputUnit) || 0;
    const amount = actionType === "call"
      ? Math.max(0, stateBeforeAction.currentBet - currentContribution)
      : actionType === "bet_raise"
        ? Math.max(0, targetAmount - currentContribution)
        : undefined;
    const displayAmount = actionType === "call" ? amount : actionType === "bet_raise" ? targetAmount : undefined;
    const text = `[USER] ${actionLabels[actionType]}${displayAmount ? ` ${formatShortAmount(displayAmount, session)}` : ""}`;
    setActions([
      ...prunedActions,
      ...autoFoldActions,
      {
        id: uid(),
        street,
        actorSessionPlayerId: player.id,
        actionType,
        amount,
        note: text,
        order: prunedActions.length + autoFoldActions.length + 1,
      },
    ].map((action, index) => ({ ...action, order: index + 1 })));
    setActionTarget(null);
  }

  function undoLastAction(street: Street) {
    setActions((current) => {
      const indexFromEnd = [...current].reverse().findIndex((action) => action.street === street);
      if (indexFromEnd === -1) return current;
      const removeAt = current.length - 1 - indexFromEnd;
      return current.filter((_, index) => index !== removeAt);
    });
  }

  async function saveGame() {
    const time = nowIso();
    const finalActions = [
      ...blindActions(activePlayers, blinds, session),
      ...visibleActions("preflop"),
      ...actions.filter((action) => action.street !== "preflop"),
    ].map((action, index) => ({
      ...action,
      order: index + 1,
    }));
    const potAmount = estimatePot(finalActions);
    const rakeAmount = estimateRake(potAmount, session);
    const wonAmount = Math.max(0, potAmount - rakeAmount);
    const participants: HandParticipant[] = orderedPlayers.map((player) => {
      return {
        id: uid(),
        sessionPlayerId: player.id,
        displayName: player.displayName,
        isHero: player.isHero,
        seatNumber: player.seatNumber,
        position: positionMap.get(player.id),
        holeCards: showdownCards[player.id] || [],
        foldedStreet: foldedStreet(player.id, finalActions),
        showdownStatus: showdownStatus[player.id] || "unknown",
        showdownCards: showdownCards[player.id] || [],
        resultAmount: winnerId === player.id ? wonAmount : undefined,
      };
    });
    await db.hands.add({
      id: uid(),
      sessionId: session.id,
      handNumber: games.length + 1,
      participants,
      board: { flop, turn: turn[0], river: river[0] },
      actions: finalActions,
      potAmount,
      rakeAmount,
      resultText: resultText || (winnerId ? `${orderedPlayers.find((player) => player.id === winnerId)?.displayName || "Winner"} won ${formatShortAmount(wonAmount, session)}` : undefined),
      movedBb: amountToBb(wonAmount, session.bigBlindAmount),
      memo: [
        memo,
        potByStreet.flop && `Flop pot ${potByStreet.flop}`,
        potByStreet.turn && `Turn pot ${potByStreet.turn}`,
        potByStreet.river && `River pot ${potByStreet.river}`,
      ].filter(Boolean).join("\n"),
      createdAt: time,
      updatedAt: time,
    });
    await db.sessions.update(session.id, { updatedAt: time, syncStatus: session.syncStatus === "synced_readonly" ? "synced_readonly" : "local_draft" });
    onDone();
  }

  if (session.syncStatus === "synced_readonly") return <ReadonlyNotice />;
  if (activePlayers.length < 3 || activePlayers.length > 9) {
    return (
      <section className="grid h-full place-items-center py-3">
        <div className="rounded-lg border border-stone-200 bg-white p-5 text-center shadow-sm">
          <h2 className="text-lg font-black">ゲーム入力は3〜9人で使えます</h2>
          <p className="mt-2 text-sm text-stone-600">現在の有効プレイヤーは{activePlayers.length}人です。卓でプレイヤーを追加してください。</p>
        </div>
      </section>
    );
  }

  return (
    <div className="h-full overflow-auto py-2">
      <div className="grid gap-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-sm">
          <div className="text-xs font-black text-slate-400">Game {games.length + 1}</div>
          <div className="truncate text-sm font-black">
            BTN: Seat{buttonSeat} / {POSITIONS_BY_PLAYERS[activePlayers.length]?.join(" ")}
          </div>
        </div>
        <button type="button" onClick={saveGame} className="rounded-lg bg-emerald-700 px-4 text-sm font-black text-white">保存</button>
      </div>

      <section className="grid grid-cols-1 gap-2 md:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-sm">
          <div className="mb-2 grid grid-cols-3 gap-1">
            {activePlayers.map((player) => (
              <button key={player.id} type="button" onClick={() => setButtonSeat(player.seatNumber)} className={`h-8 rounded-md border text-xs font-black ${buttonSeat === player.seatNumber ? "border-emerald-400 bg-emerald-500/25 text-emerald-100" : "border-slate-700 bg-slate-800 text-slate-300"}`}>
                Seat{player.seatNumber} BTN
              </button>
            ))}
          </div>
          <div className="pr-1">
            {orderedPlayers.map((player) => (
              <div key={player.id} className="mb-1 grid grid-cols-[46px_1fr_auto] items-center gap-2 rounded-md bg-slate-800/90 p-2">
                <span className="rounded bg-slate-600 px-2 py-1 text-center text-xs font-black">{positionMap.get(player.id) || "-"}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">{player.displayName}{player.isHero ? " / Hero" : ""}</div>
                  <div className="text-[11px] text-slate-400">Seat{player.seatNumber}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setCardTarget({ label: `${player.displayName} ホールカード`, max: 2, cards: showdownCards[player.id] || [], setCards: (cards) => {
                    setShowdownCards((current) => ({ ...current, [player.id]: cards }));
                    setShowdownStatus((current) => ({ ...current, [player.id]: cards.length ? "shown" : current[player.id] || "unknown" }));
                  }, onComplete: () => setCardTarget(null) })} className="flex gap-1">
                    <MiniCard card={showdownCards[player.id]?.[0]} />
                    <MiniCard card={showdownCards[player.id]?.[1]} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-100 shadow-sm">
            <div className="grid grid-cols-[1fr_74px_74px] gap-2">
              <BoardCardGroup label="Flop" cards={flop} max={3} pot={potByStreet.flop} onPot={(value) => setPotByStreet((current) => ({ ...current, flop: value }))} onCard={() => setCardTarget({ label: "フロップ", max: 3, cards: flop, setCards: setFlop, onComplete: () => setCardTarget(null) })} />
              <BoardCardGroup label="Turn" cards={turn} max={1} pot={potByStreet.turn} onPot={(value) => setPotByStreet((current) => ({ ...current, turn: value }))} onCard={() => setCardTarget({ label: "ターン", max: 1, cards: turn, setCards: setTurn, onComplete: () => setCardTarget(null) })} />
              <BoardCardGroup label="River" cards={river} max={1} pot={potByStreet.river} onPot={(value) => setPotByStreet((current) => ({ ...current, river: value }))} onCard={() => setCardTarget({ label: "リバー", max: 1, cards: river, setCards: setRiver, onComplete: () => setCardTarget(null) })} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-sm">
            {(["preflop", "flop", "turn", "river"] as Street[]).map((street) => {
              const rows = actionRowsForStreet(street);
              return (
                <section key={street} className="border-b border-slate-700 py-2 last:border-0">
                  <div className="mb-2 flex items-center justify-between">
                    <button type="button" onClick={() => setActiveStreet(street)} className={`text-left text-lg font-black ${activeStreet === street ? "text-emerald-300" : "text-slate-200"}`}>{streetLabels[street]} {street !== "preflop" && <span className="text-sm text-slate-400">{potByStreet[street] && `${potByStreet[street]}`}</span>}</button>
                    <button type="button" onClick={() => undoLastAction(street)} className="text-xs font-bold text-slate-400">戻す</button>
                  </div>
                  <div className="grid gap-1">
                    {rows.map(({ player, repeat }, rowIndex) => {
                      const playerActions = visibleActions(street).filter((action) => action.actorSessionPlayerId === player.id);
                      const latest = playerActions.at(-1);
                      const isCurrent = actionTarget?.playerId === player.id && actionTarget.street === street;
                      return (
                        <button key={`${street}-${player.id}-${rowIndex}`} type="button" onClick={() => {
                          setActiveStreet(street);
                          setActionTarget({ playerId: player.id, street });
                        }} className={`grid grid-cols-[48px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left ${isCurrent ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-100"}`}>
                          <span className="rounded bg-slate-600 px-2 py-1 text-center text-xs font-black text-white">{positionMap.get(player.id) || "-"}</span>
                          <span className="truncate text-sm font-black">{player.displayName}{repeat ? " / 再アクション" : ""}</span>
                          <span className={`text-sm font-black ${actionColor(latest?.actionType)}`}>{latest ? actionDisplay(latest, session) : "未入力"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setResultOpen(true)} className="h-10 rounded-md border border-slate-300 bg-white text-sm font-black">結果</button>
            <input value={resultText} onChange={(event) => setResultText(event.target.value)} placeholder="結果" className="input" />
            <button type="button" onClick={saveGame} className="h-10 rounded-md bg-emerald-700 text-sm font-black text-white">保存</button>
          </div>
        </div>
      </section>

      <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="メモ" className="h-12 resize-none rounded-md border border-stone-300 bg-white p-2 text-sm shadow-sm" />

      <ActionSheet
        target={actionTarget}
        players={activePlayers}
        session={session}
        onClose={() => setActionTarget(null)}
        onAdd={addAction}
      />

      <BottomSheet title="結果" open={resultOpen} onClose={() => setResultOpen(false)}>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-stone-100 p-2 font-bold">Pot: {formatShortAmount(currentPotAmount, session)}</div>
            <div className="rounded-md bg-stone-100 p-2 font-bold">Rake: {formatShortAmount(currentRakeAmount, session)}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-black text-stone-600">勝者</div>
            <div className="grid max-h-[36dvh] gap-2 overflow-auto">
              {livePlayers.map((player) => (
                <button key={player.id} type="button" onClick={() => {
                  setWinnerId(player.id);
                  setResultText(`${player.displayName} won ${formatShortAmount(winnerAmount, session)}`);
                }} className={`h-10 rounded-md border text-sm font-black ${winnerId === player.id ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
                  {positionMap.get(player.id)} {player.displayName}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-emerald-50 p-2 text-sm font-bold text-emerald-900">
            勝者獲得: {formatShortAmount(winnerAmount, session)}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet title={cardTarget?.label || "カード"} open={!!cardTarget} onClose={() => setCardTarget(null)}>
        {cardTarget && <CardPicker cards={cardTarget.cards} max={cardTarget.max} usedCards={usedCards.filter((card) => !cardTarget.cards.includes(card))} onChange={cardTarget.setCards} onComplete={cardTarget.onComplete} />}
      </BottomSheet>
      </div>
    </div>
  );
}

function hasFoldedBeforeStreet(playerId: string, actions: HandAction[], street: Street) {
  const order: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
  const targetIndex = order.indexOf(street);
  return actions.some((action) => action.actorSessionPlayerId === playerId && action.actionType === "fold" && order.indexOf(action.street) < targetIndex);
}

function isAllInBeforeStreet(playerId: string, actions: HandAction[], street: Street) {
  const order: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
  const targetIndex = order.indexOf(street);
  return actions.some((action) => action.actorSessionPlayerId === playerId && action.actionType === "allin" && order.indexOf(action.street) < targetIndex);
}

function blindActions(players: SessionPlayer[], blinds: ReturnType<typeof deriveButtonBlindSeats>, session: Session): HandAction[] {
  const actions: HandAction[] = [];
  const sb = players.find((player) => player.seatNumber === blinds.sbSeat);
  const bb = players.find((player) => player.seatNumber === blinds.bbSeat);
  if (sb) {
    actions.push({
      id: `blind-sb-${sb.id}`,
      street: "preflop",
      actorSessionPlayerId: sb.id,
      actionType: "blind",
      amount: session.smallBlindAmount,
      note: `[BLIND] SB ${formatShortAmount(session.smallBlindAmount, session)}`,
      order: 0,
    });
  }
  if (bb) {
    actions.push({
      id: `blind-bb-${bb.id}`,
      street: "preflop",
      actorSessionPlayerId: bb.id,
      actionType: "blind",
      amount: session.bigBlindAmount,
      note: `[BLIND] BB ${formatShortAmount(session.bigBlindAmount, session)}`,
      order: 1,
    });
  }
  return actions;
}

function streetState(actions: HandAction[], street: Street, session: Session, blinds: ReturnType<typeof deriveButtonBlindSeats>) {
  const contributions = new Map<string, number>();
  let currentBet = street === "preflop" ? session.bigBlindAmount : 0;
  const latestByPlayer = new Map<string, HandAction>();

  if (street === "preflop") {
    actions
      .filter((action) => action.street === "preflop" && action.actionType === "blind")
      .forEach((action) => contributions.set(action.actorSessionPlayerId, (contributions.get(action.actorSessionPlayerId) || 0) + (action.amount || 0)));
  }

  actions
    .filter((action) => action.street === street && action.actionType !== "blind")
    .sort((a, b) => a.order - b.order)
    .forEach((action) => {
      latestByPlayer.set(action.actorSessionPlayerId, action);
      if (action.amount) {
        const nextContribution = (contributions.get(action.actorSessionPlayerId) || 0) + action.amount;
        contributions.set(action.actorSessionPlayerId, nextContribution);
        if (action.actionType === "bet_raise" || action.actionType === "allin") currentBet = Math.max(currentBet, nextContribution);
      }
    });

  if (street === "preflop" && !actions.some((action) => action.actionType === "blind")) {
    if (blinds.sbSeat) currentBet = Math.max(currentBet, session.smallBlindAmount);
    if (blinds.bbSeat) currentBet = Math.max(currentBet, session.bigBlindAmount);
  }

  return { currentBet, contributions, latestByPlayer };
}

function requiredPlayers(orderPlayers: SessionPlayer[], actions: HandAction[], street: Street, session: Session, blinds: ReturnType<typeof deriveButtonBlindSeats>) {
  const state = streetState(actions, street, session, blinds);
  const latestRaise = [...actions]
    .filter((action) => action.street === street && (action.actionType === "bet_raise" || action.actionType === "allin"))
    .sort((a, b) => a.order - b.order)
    .at(-1);

  return orderPlayers.filter((player) => {
    const latest = state.latestByPlayer.get(player.id);
    if (latest?.actionType === "fold" || latest?.actionType === "allin") return false;
    if (!latest) return true;
    if (!latestRaise || latestRaise.actorSessionPlayerId === player.id) return false;
    return latest.order < latestRaise.order;
  });
}

function skippedPlayersForAction(
  orderPlayers: SessionPlayer[],
  actions: HandAction[],
  street: Street,
  targetPlayerId: string,
  actionType: ActionType,
  session: Session,
  blinds: ReturnType<typeof deriveButtonBlindSeats>
) {
  if (street !== "preflop" && actionType === "check") return [];
  const targetIndex = orderPlayers.findIndex((player) => player.id === targetPlayerId);
  if (targetIndex <= 0) return [];
  const required = new Set(requiredPlayers(orderPlayers, actions, street, session, blinds).map((player) => player.id));
  return orderPlayers.slice(0, targetIndex).filter((player) => required.has(player.id));
}

function foldedStreet(playerId: string, actions: HandAction[]) {
  return actions.find((action) => action.actorSessionPlayerId === playerId && action.actionType === "fold")?.street;
}

function actionColor(type?: ActionType) {
  if (type === "fold") return "text-blue-400";
  if (type === "bet_raise" || type === "allin") return "text-red-400";
  if (type === "check" || type === "call") return "text-emerald-400";
  return "text-slate-300";
}

function actionDisplay(action: HandAction, session: Session) {
  if (action.note?.startsWith("[AUTO]")) return "Auto Fold";
  if (action.note?.startsWith("[BLIND]")) return action.note.replace("[BLIND] ", "");
  if (action.note?.startsWith("[USER]")) return action.note.replace("[USER] ", "");
  const amount = action.amount ? ` ${formatShortAmount(action.amount, session)}` : "";
  return `${actionLabels[action.actionType]}${amount}`;
}

function formatShortAmount(amount: number | undefined, session: Pick<Session, "amountInputUnit" | "playUnitName">) {
  if (amount === undefined || Number.isNaN(amount)) return "-";
  const short = amount / session.amountInputUnit;
  const text = Number.isInteger(short) ? String(short) : short.toFixed(1);
  return `${text}${session.playUnitName ? ` ${session.playUnitName}` : ""}`;
}

function ActionSheet({
  target,
  players,
  session,
  onClose,
  onAdd,
}: {
  target: { playerId: string; street: Street } | null;
  players: SessionPlayer[];
  session: Session;
  onClose: () => void;
  onAdd: (player: SessionPlayer, actionType: ActionType, amountInput?: string, street?: Street) => void;
}) {
  const [amount, setAmount] = useState("");
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const player = players.find((item) => item.id === target?.playerId);
  if (!target || !player) return null;
  return (
    <BottomSheet title={`${player.displayName} ${streetLabels[target.street]}`} open onClose={onClose}>
      <div className="grid gap-2">
        <div className="grid grid-cols-3 gap-2">
          {([
            ["fold", "Fold"],
            ["check", "Check"],
            ["call", "Call"],
            ["bet_raise", "Bet/Raise"],
            ["allin", "All-in"],
          ] as [ActionType, string][]).map(([type, label]) => (
            <button key={type} type="button" onClick={() => {
              if (type === "bet_raise") {
                setPendingAction(type);
                return;
              }
              onAdd(player, type, "", target.street);
              setAmount("");
            }} className={`h-11 rounded-md border text-sm font-black ${pendingAction === type ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
              {label}
            </button>
          ))}
        </div>
        {pendingAction === "bet_raise" && (
          <div className="grid gap-2">
            <AmountInput label="Bet/Raise額（省略可）" value={amount} session={session} onChange={setAmount} />
            <button type="button" onClick={() => {
              onAdd(player, "bet_raise", amount, target.street);
              setAmount("");
              setPendingAction(null);
            }} className="h-11 rounded-md bg-emerald-800 text-sm font-black text-white">
              Bet/Raiseを保存
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function MiniCard({ card }: { card?: string }) {
  if (!card) return <span className="h-8 w-7 rounded border border-slate-500 bg-slate-950" />;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitLabel = SUITS.find((item) => item.value === suit)?.label || suit;
  const colors: Record<string, string> = {
    h: "bg-red-500 text-white",
    d: "bg-blue-600 text-white",
    s: "bg-zinc-900 text-white",
    c: "bg-emerald-600 text-white",
  };
  return <span className={`grid h-8 w-7 place-items-center rounded border border-white/70 text-xs font-black ${colors[suit] || "bg-slate-600 text-white"}`}>{rank}{suitLabel}</span>;
}

function BoardCardGroup({ label, cards, max, pot, onPot, onCard }: { label: string; cards: string[]; max: number; pot: string; onPot: (value: string) => void; onCard: () => void }) {
  return (
    <div>
      <button type="button" onClick={onCard} className="flex min-h-10 w-full items-center gap-1 rounded-md bg-slate-800 p-1">
        {Array.from({ length: max }).map((_, index) => <MiniCard key={index} card={cards[index]} />)}
      </button>
      <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-1 text-[10px] font-black text-slate-400">
        <span>{label}</span>
        <input value={pot} onChange={(event) => onPot(event.target.value)} inputMode="decimal" placeholder="Pot" className="h-6 min-w-0 rounded border border-slate-700 bg-slate-950 px-1 text-right text-xs text-slate-100" />
      </div>
    </div>
  );
}

function CardPicker({ cards, max, usedCards, onChange, onComplete }: { cards: string[]; max: number; usedCards: string[]; onChange: (cards: string[]) => void; onComplete?: () => void }) {
  const [rank, setRank] = useState<string | null>(null);
  function add(suit: string) {
    if (!rank || cards.length >= max) return;
    const card = `${rank}${suit}`;
    if (cards.includes(card) || usedCards.includes(card)) return;
    const nextCards = [...cards, card];
    onChange(nextCards);
    setRank(null);
    if (nextCards.length >= max) setTimeout(() => onComplete?.(), 80);
  }
  function remove(index: number) {
    onChange(cards.filter((_, cardIndex) => cardIndex !== index));
    setRank(null);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, index) => (
            <button key={index} type="button" onClick={() => cards[index] && remove(index)} className="relative">
              <MiniCard card={cards[index]} />
            </button>
          ))}
        </div>
        {cards.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs font-bold text-stone-500">全削除</button>}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {RANKS.map((item) => (
          <button key={item} type="button" onClick={() => setRank(item)} className={`h-10 rounded-md border text-base font-black ${rank === item ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white"}`}>
            {item}
          </button>
        ))}
      </div>
      {rank && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {SUITS.map((suit) => (
            <button key={suit.value} type="button" onClick={() => add(suit.value)} disabled={usedCards.includes(`${rank}${suit.value}`)} className={`h-12 rounded-md border border-stone-200 bg-white text-2xl font-black disabled:opacity-30 ${suit.value === "h" ? "text-red-600" : suit.value === "d" ? "text-blue-600" : suit.value === "c" ? "text-emerald-700" : "text-zinc-950"}`}>
              {suit.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AmountInput({ label, value, session, onChange }: { label: string; value: string; session: Pick<Session, "amountInputUnit" | "bigBlindAmount" | "playUnitName">; onChange: (value: string) => void }) {
  const actual = parseAmount(value, session.amountInputUnit);
  return (
    <Field label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="input" />
      <span className="mt-1 block text-xs text-stone-500">{actual === undefined ? `省略単位: ${session.amountInputUnit.toLocaleString()}` : `${formatShortAmount(actual, session)}（実額 ${formatAmount(actual, session.playUnitName)}）`}</span>
    </Field>
  );
}

function ExportPanel({ session, players, games, onDone }: { session: Session; players: SessionPlayer[]; games: Hand[]; onDone: () => void }) {
  const markdown = useMemo(() => buildMarkdown(session, players, games), [games, players, session]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function sync() {
    const result = await uploadSessionBundle(session, players, games);
    await db.sessions.update(session.id, { syncStatus: result.ok ? "synced_readonly" : "sync_pending", updatedAt: nowIso() });
    onDone();
  }

  async function deleteLocalSynced() {
    if (session.syncStatus !== "synced_readonly") return;
    await Promise.all([db.hands.where("sessionId").equals(session.id).delete(), db.sessionPlayers.where("sessionId").equals(session.id).delete(), db.sessions.delete(session.id)]);
    onDone();
  }

  return (
    <div className="grid h-full grid-rows-[1fr_auto] gap-3 py-3">
      <textarea readOnly value={markdown} className="min-h-0 resize-none rounded-lg border border-stone-200 bg-white p-3 font-mono text-xs shadow-sm" />
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={copy} className="bottom-btn bg-stone-900 text-white">{copied ? <BadgeCheck size={17} /> : <Copy size={17} />}{copied ? "コピー済み" : "コピー"}</button>
        <button type="button" onClick={sync} className="bottom-btn bg-white text-stone-900"><Cloud size={17} />クラウド同期</button>
        <button type="button" disabled={session.syncStatus !== "synced_readonly"} onClick={deleteLocalSynced} className="bottom-btn bg-white text-stone-900 disabled:opacity-40"><Trash2 size={17} />端末削除</button>
      </div>
    </div>
  );
}

function HistoryPanel({ sessions, onSelect }: { sessions: Session[]; onSelect: (id: string) => void }) {
  return (
    <section className="h-full overflow-auto py-3">
      <div className="space-y-2">
        {sessions.map((session) => (
          <button key={session.id} type="button" onClick={() => onSelect(session.id)} className="block w-full rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm">
            <div className="font-black">{session.date} {session.venueName}</div>
            <div className="text-sm text-stone-500">{session.country} / {session.rateLabel} / {syncLabel(session.syncStatus)}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function GameHistoryScreen({ session, games, onBack }: { session: Session; games: Hand[]; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState(games.at(-1)?.id || "");
  const selected = games.find((game) => game.id === selectedId) || games.at(-1);

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3 py-3">
      <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-sm">
        <div>
          <div className="text-xs font-black text-slate-400">Game History</div>
          <div className="text-lg font-black">{session.venueName} / {games.length}ゲーム</div>
        </div>
        <button type="button" onClick={onBack} className="h-10 rounded-md bg-white px-3 text-sm font-black text-slate-900">卓へ</button>
      </div>
      <section className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-[42%_1fr]">
        <div className="min-h-0 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-sm">
          {games.length === 0 && <div className="text-sm text-slate-400">まだゲームがありません。</div>}
          {games.slice().reverse().map((game) => {
            const hero = game.participants.find((participant) => participant.isHero) || game.participants[0];
            const board = [...game.board.flop, game.board.turn, game.board.river].filter(Boolean);
            return (
              <button key={game.id} type="button" onClick={() => setSelectedId(game.id)} className={`mb-2 block w-full rounded-md p-3 text-left ${selected?.id === game.id ? "bg-slate-700" : "bg-slate-800"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black">Game {game.handNumber}</span>
                  <span className={`text-sm font-black ${(game.movedBb || 0) < 0 ? "text-red-400" : (game.movedBb || 0) > 0 ? "text-emerald-400" : "text-slate-300"}`}>
                    {game.movedBb !== undefined ? `${game.movedBb > 0 ? "+" : ""}${game.movedBb}bb` : "±0bb"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{new Date(game.createdAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="rounded bg-slate-600 px-2 py-0.5 font-black text-slate-100">{hero?.position || "-"}</span>
                  <span>{hero?.holeCards?.join(" ") || "-"}</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {board.length ? board.map((card) => <MiniCard key={card} card={card} />) : <span className="text-xs text-slate-500">Boardなし</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="min-h-0 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-sm">
          {selected ? <GameHistoryDetail session={session} game={selected} /> : <div className="text-sm text-slate-400">ゲームを選択してください。</div>}
        </div>
      </section>
    </div>
  );
}

function GameHistoryDetail({ session, game }: { session: Session; game: Hand }) {
  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 text-lg font-black">Game {game.handNumber}</div>
        <div className="space-y-1">
          {game.participants.map((participant) => (
            <div key={participant.id} className="grid grid-cols-[48px_1fr_auto_auto] items-center gap-2 rounded-md bg-slate-800 p-2">
              <span className="rounded bg-slate-600 px-2 py-1 text-center text-xs font-black">{participant.position || "-"}</span>
              <span className="truncate text-sm font-black">{participant.displayName}</span>
              <span className="flex gap-1">{participant.holeCards?.map((card) => <MiniCard key={card} card={card} />)}</span>
              <span className={`text-sm font-black ${(participant.resultAmount || 0) < 0 ? "text-red-400" : (participant.resultAmount || 0) > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                {participant.resultAmount !== undefined ? formatShortAmount(participant.resultAmount, session) : "±0"}
              </span>
            </div>
          ))}
        </div>
      </section>
      {(["preflop", "flop", "turn", "river"] as Street[]).map((street) => {
        const boardText = street === "flop" ? game.board.flop.join(" ") : street === "turn" ? game.board.turn : street === "river" ? game.board.river : "";
        const streetActions = game.actions.filter((action) => action.street === street);
        return (
          <section key={street} className="border-t border-slate-700 pt-3">
            <div className="mb-2 text-lg font-black">{streetLabels[street]} <span className="text-sm text-slate-400">{boardText}</span></div>
            <div className="space-y-1">
              {streetActions.length ? streetActions.map((action) => {
                const actor = game.participants.find((participant) => participant.sessionPlayerId === action.actorSessionPlayerId);
                return (
                  <div key={action.id} className="grid grid-cols-[48px_1fr_auto] items-center gap-2 rounded-md bg-slate-800 p-2">
                    <span className="rounded bg-slate-600 px-2 py-1 text-center text-xs font-black">{actor?.position || "-"}</span>
                    <span className="truncate text-sm font-black">{actor?.displayName || "不明"}</span>
                    <span className={`text-sm font-black ${actionColor(action.actionType)}`}>{actionDisplay(action, session)}</span>
                  </div>
                );
              }) : <div className="text-sm text-slate-500">入力なし</div>}
            </div>
          </section>
        );
      })}
      <section className="border-t border-slate-700 pt-3 text-sm text-slate-300">
        <div className="font-black text-slate-100">Result</div>
        <div>{game.resultText || "-"}</div>
        <div>Pot: {formatAmount(game.potAmount, session.playUnitName)} / Rake: {formatAmount(game.rakeAmount, session.playUnitName)}</div>
        {game.memo && <div className="mt-2 whitespace-pre-wrap text-slate-400">{game.memo}</div>}
      </section>
    </div>
  );
}

function ReadonlyNotice() {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">同期済みセッションは端末ではReadonlyです</h2>
      <p className="mt-2 text-sm text-stone-600">追記や修正はクラウド編集モードで扱います。</p>
    </section>
  );
}

function BottomSheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/25">
      <section className="max-h-[72dvh] w-full rounded-t-2xl bg-[#fbfaf6] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md border border-stone-200 bg-white">
            <X size={17} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function buildMarkdown(session: Session, players: SessionPlayer[], games: Hand[]) {
  const lines: string[] = [];
  lines.push(`# Session: ${session.date} ${session.venueName}`);
  lines.push(`Country: ${session.country}`);
  lines.push(`Game: ${session.rateLabel} ${session.playUnitName}`);
  lines.push(`Rake: ${session.rakePercent}% cap ${session.rakeCapBb}BB`);
  lines.push("");
  lines.push("## Players");
  players.forEach((player) => {
    const stats = summarizePlayerStats(player, games, session.bigBlindAmount);
    lines.push(`- Seat${player.seatNumber}: ${player.displayName}${player.isHero ? " (Hero)" : ""}`);
    lines.push(`  Session games involved: ${stats.involvedHands}`);
    lines.push(`  Showdowns seen: ${stats.showdownsSeen}`);
    const tendencies = Object.entries(player.sessionTendencies).filter(([, value]) => value).map(([key, value]) => `${TENDENCY_LABELS[key as keyof PlayerTendencies]} ${value}`).join(", ");
    if (tendencies) lines.push(`  Tendencies: ${tendencies}`);
    if (player.sessionNotes) lines.push(`  Notes: ${player.sessionNotes}`);
  });
  lines.push("");
  lines.push("## Games");
  games.forEach((game) => {
    lines.push(`### Game ${game.handNumber}`);
    lines.push(`Players: ${game.participants.map(participantLabel).join(" / ")}`);
    lines.push(`Board: ${[...game.board.flop, game.board.turn, game.board.river].filter(Boolean).join(" ") || "未入力"}`);
    (["preflop", "flop", "turn", "river"] as Street[]).forEach((street) => {
      const streetActions = game.actions.filter((action) => action.street === street);
      if (!streetActions.length) return;
      lines.push(`${streetLabels[street]}: ${streetActions.map((action) => {
        const actor = game.participants.find((participant) => participant.sessionPlayerId === action.actorSessionPlayerId);
        if (action.note) return action.note;
        return `${actor?.displayName || "不明"} ${actionLabels[action.actionType]}${action.amount ? ` ${formatAmount(action.amount, session.playUnitName)} (${formatBb(action.amount, session.bigBlindAmount)})` : ""}`;
      }).join(", ")}`);
    });
    lines.push("Showdown:");
    game.participants.forEach((participant) => {
      const status = participant.showdownStatus === "mucked" ? "マック" : participant.showdownStatus === "shown" ? participant.showdownCards.join(" ") || "ショー" : "不明";
      lines.push(`- Seat${participant.seatNumber} ${participant.displayName}: ${status}`);
    });
    lines.push(`Pot: ${formatAmount(game.potAmount, session.playUnitName)} / Rake: ${formatAmount(game.rakeAmount, session.playUnitName)}`);
    if (game.resultText) lines.push(`Result: ${game.resultText}`);
    if (game.movedBb !== undefined) lines.push(`Moved BB: ${game.movedBb}`);
    if (game.memo) lines.push(`Memo: ${game.memo}`);
    lines.push("");
  });
  lines.push("## Please analyze");
  lines.push("1. Heroの判断が+EVだったか");
  lines.push("2. 大型ポットとオールイン");
  lines.push("3. 明確なミスと推定BB損失");
  lines.push("4. バリュー取り逃し");
  lines.push("5. 強い相手・危険な相手への余計な支払い");
  lines.push("6. 次回以降に使えるプレイヤー傾向");
  return lines.join("\n");
}

function syncLabel(status: Session["syncStatus"]) {
  return {
    local_draft: "ローカル",
    sync_pending: "同期待ち",
    synced_readonly: "同期済みReadonly",
    sync_failed: "同期失敗",
  }[status];
}
