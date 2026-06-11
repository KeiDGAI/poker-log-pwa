# Poker Log PWA Current Spec

## Purpose

This document describes the **currently implemented behavior** of the app in `/src/components/PokerLogApp.tsx`.

It is written for both humans and AI agents.

Rules for interpretation:

- Treat this document as the source of truth for the **current working UI**.
- Do **not** assume that every type or helper under `/src/lib` is already connected to the current UI.
- When code and this document differ, prefer the code in `/src/components/PokerLogApp.tsx`.

## Product Summary

- Product name: `ポーカープレーログ` / `Poker Log`
- App type: mobile-first Next.js PWA
- Main goal: quickly capture **player notes during live play** on one device; session metadata and hand notes are secondary supporting features
- Primary storage: browser `localStorage`
- Current persistence scope: local device only
- Current auth: none
- Current multiplayer/collaboration: none
- Current cloud sync in UI: none

## Current Runtime Architecture

### Active UI

- Entry page: `/src/app/page.tsx`
- Root component: `/src/components/PokerLogApp.tsx`
- Rendering model: single client-side React app
- Main navigation model: internal screen state, not URL routing

### Screens

The app has 5 internal screens:

1. `list`
2. `detail`
3. `live`
4. `export`
5. `playerNotes`

## Data Persistence

### Actual storage used by the current UI

- Storage backend: `localStorage`
- Storage key: `poker-log-fast-v1`
- Load timing: on initial mount
- Save timing: whenever `sessions` changes after initial load

### Persistence behavior

- If saved JSON exists, it is parsed and used as the full app state.
- If parsing fails, the app falls back to an empty session list.
- There is no migration logic.
- There is no merge logic across devices.
- There is no server fetch on startup.

## Actual Current Data Model

The current UI uses its own in-component types. These are the active shapes that matter.

### Session

```ts
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
  seatCount?: number;
  hands: HandNote[];
};
```

Field semantics:

- `dateTime`: `datetime-local` input value
- `place`: free text venue/store/location
- `stake`: free text such as `1-3`
- `buyIn`, `rebuy`, `cashOut`: free text, not numeric-validated
- `rakeMemo`: free text memo
- `playerNotesText`: one large text block for player notes
- `sessionMemo`: one large text block for session-level notes
- `seatCount`: optional table size, `9` or `10`; missing value means `9` (backward compatibility with old saved data)
- `hands`: ordered array of hand notes

### Hand

```ts
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
  actions: Record<"preflop" | "flop" | "turn" | "river", QuickAction[]>;
  result: "" | "Win" | "Lose" | "Chop" | "Folded" | "No Showdown";
  amountMemo: string;
  handMemo: string;
};
```

### Action

```ts
type QuickAction = {
  id: string;
  position: string;
  action: string;
  size?: string;
  street: "preflop" | "flop" | "turn" | "river";
  order: number;
  createdAt: string;
};
```

## Fixed Choice Sets Used by the Current UI

### Positions

`UTG`, `UTG1`, `UTG2`, `LJ`, `HJ`, `CO`, `BTN`, `SB`, `BB`

### Streets

`preflop`, `flop`, `turn`, `river`

### Preflop actions

`Fold`, `Limp`, `Open`, `Call`, `3bet`, `4bet`, `All-in`

### Postflop actions

`Check`, `Call`, `Raise`, `All-in`, `Fold`

### Postflop raise sizes

`33%`, `50%`, `75%`, `100%`, `120%`, `More`

### Board tags

`Wet`, `Dry`, `Two-tone`, `Monotone`, `Rainbow`, `Paired`, `Connected`, `Flush draw`

### Quick hero hands

`AA`, `KK`, `QQ`, `JJ`, `TT`, `AKs`, `AKo`, `AQs`, `AQo`, `AJs`, `KQs`, `QJs`, `JTs`, `T9s`, `A5s`

### Result choices

`Win`, `Lose`, `Chop`, `Folded`, `No Showdown`

## Screen Specs

### 1. Session List Screen

Purpose:

- show saved sessions
- start a new session
- open, export, or delete an existing session

Behavior:

- If no sessions exist, show an empty-state message.
- Sessions are shown in current array order.
- New sessions are inserted at the front of the array.
- Each session card shows:
  - date/time
  - place
  - stake
  - hand count
  - buy-in / cash-out if either exists

Actions:

- `New`: create a blank session and move to `detail`
- `Notes`: move directly to `playerNotes` (primary in-play entry point, highlighted button)
- `Open`: move to `detail`
- `Export`: move to `export`
- `Delete`: remove the session permanently from local storage

### 2. Session Detail Screen

Purpose:

- edit session metadata
- enter session memo
- open player notes editor
- manage saved hands

Editable fields:

- `dateTime`
- `stake`
- `place`
- `buyIn`
- `rebuy`
- `cashOut`
- `rakeMemo`
- `seatCount` (toggle: `9人卓` / `10人卓`; switching does not delete existing notes — `10:` lines simply stop rendering a seat button when set to 9, but stay in the text)
- `sessionMemo`

Player Notes behavior:

- The primary CTA on this screen is a large `Player Notes` button (with character count) that opens the `playerNotes` screen.
- `playerNotesText` is not edited inline here.

Hand management:

- `ハンド記録`: create or record a hand in Live Mode (secondary button, same row as Export/Delete)
- `Export`: open export screen
- `Delete`: delete current session
- For each hand:
  - `Edit`
  - `Duplicate`
  - `Copy`
  - `Delete`

Hand duplication behavior:

- Duplicates the full hand via `structuredClone`
- Generates a new `id`
- Resets `createdAt` and `updatedAt`
- Inserts the duplicate immediately after the original

Hand copy behavior:

- Copies a compact text block to clipboard
- Format includes:
  - hand number
  - hero summary
  - board summary
  - action summary
  - result
  - amount
  - memo

### 3. Player Notes Screen (primary in-play screen)

Purpose:

- fast in-play capture of per-seat player notes, optimized for tap-then-type during a live hand

Underlying storage:

- Only one string is stored: `session.playerNotesText`
- Every edit is auto-saved immediately (the screen calls `onChange` per keystroke; there is no Save or Cancel button, only `Back`)

Supported seat label format:

- Base seat: `1` to `10` (the number of seat buttons shown follows `session.seatCount`, default 9)
- Shift/history seat label: `1-2`, `1-3`, `10-2`, etc.

Parsing rules:

- Lines matching `^((?:10|[1-9])(?:-\d+)?)\\s*:\\s*(.*)$` are treated as seat lines
- Non-empty lines not matching that pattern are treated as free lines
- Base-seat matching uses the part of the label before the first `-`, so seat `1` never matches `10` labels

Seat grid UI behavior:

- A sticky grid of seat buttons sits at the top (3 columns for 9 seats, 5 columns for 10 seats).
- Each button shows the active label (e.g. `1-2`) and a truncated preview of the latest note.
- Tapping a seat selects it, opens an edit area directly below the grid, and focuses the textarea.
- Tapping the selected seat again deselects it.
- Editing the textarea updates the latest matching label for that base seat; if no label exists yet, the base label (e.g. `3: ...`) is created.

New player behavior (player turnover at the same seat):

- Pressing `新プレイヤー` creates the next numbered shift label for the selected seat (e.g. `1`, `1-2` → `1-3`) with empty content and focuses it.
- Previous labels remain in the text as history, shown read-only under `過去のプレイヤー`.

Seat move behavior (same player changes seats):

- Pressing `席替え →` enters move mode; the next seat-grid tap chooses the destination.
- On destination tap (`transferSeatNotes`):
  1. The source seat's latest note content is appended as a new label on the destination seat (the base label if the destination has no lines yet, otherwise the next shift label, e.g. `7-2`). Existing destination notes are preserved as history.
  2. A new empty shift label is appended on the source seat (for the empty seat / next player).
  3. The destination seat becomes selected.
- Tapping `席替え →` again, or tapping the source seat itself, cancels move mode.

Secondary sections (collapsed by default):

- `フリーメモ`: textarea editing only the free (non-seat) lines
- `全文編集`: raw textarea editing the entire `playerNotesText` string

Important limitation:

- The screen keeps only text structure. There is no normalized player entity in the active UI.

### 4. Live Mode Screen

Purpose:

- fast hand entry optimized for tap-based use

Editing scope:

- create a new hand
- edit an existing hand

Sections:

1. `Action`
2. `Board`
3. `Hero Hand`
4. `Hero Position`
5. `Result / Amount / Memo`

Default open state:

- `Action`: open
- `Board`: open
- `Hero Hand`: closed
- `Hero Position`: closed
- `Result / Amount / Memo`: closed

#### 4.1 Action section

Behavior:

- User selects one `activeStreet`
- User selects one temporary `selectedPosition`
- Pressing an action appends a new action to the active street
- Actions are append-only until undo/clear is used

Action append rules:

- Position is required to append
- No deduplication is performed
- The same position can appear multiple times
- `order` is `current.actions[street].length + 1`

Size rules:

- Size is only attached when:
  - current street is not `preflop`
  - action is exactly `Raise`
- Preflop actions do not store a size in the current UI

Undo/clear rules:

- `Undo last`: removes the most recent action from the active street only
- `Clear street`: removes all actions from the active street only

#### 4.2 Board section

Supported board fields:

- `flop`: rank string, expected length up to 3
- `turn`: rank string, expected length up to 1
- `river`: rank string, expected length up to 1
- `flopSuits`: suit string, expected length up to 3
- `turnSuit`: one suit code
- `riverSuit`: one suit code
- `tags`: string array

Board rank entry rules:

- Flop rank input is capped at 3 characters when using tap buttons
- Turn and river are capped at 1 character when using tap buttons
- Direct text inputs also exist and can overwrite values manually

Suit entry rules:

- Suit codes used: `s`, `h`, `d`, `c`
- Flop suits are stored as a compact string such as `shd`
- Turn and river suit are stored as one code each

Formatting rule:

- If rank count and suit count differ, formatted text adds ` (suit incomplete)`

Clear behavior:

- `Clear flop/turn/river`: clears that street's board ranks and related suit field
- `Clear Board`: clears all board ranks, suits, and tags

Tag behavior:

- Tags toggle on/off
- No ranking or exclusivity rules exist

#### 4.3 Hero Hand section

Supported entry modes:

- rank pair / suitedness picker
- quick hand buttons
- exact card input mode

Combo entry rules:

- Pair example: choosing `A` + `A` sets `heroHand = "AA"`
- Non-pair example: choosing `A` + `K` then `s` sets `heroHand = "AKs"`
- Non-pair example: choosing `A` + `K` then `o` sets `heroHand = "AKo"`

Exact card input behavior:

- Exact mode stores a string like `Ah Kd` in `exactHeroHand`
- It also sets `heroHand` to the concatenated exact cards, for example `AhKd`
- Only the last two chosen exact cards are kept

Important nuance:

- `heroHand` is sometimes a range-style value like `AKo`
- `heroHand` is sometimes an exact concatenated value like `AhKd`
- Consumers must not assume one strict format

#### 4.4 Hero Position section

Behavior:

- Stores one free string chosen from the position button set
- No validation beyond button selection in the UI

#### 4.5 Result / Amount / Memo section

Behavior:

- `result` is selected from fixed buttons
- `amountMemo` is free text
- `handMemo` is free text

Examples of valid `amountMemo`:

- `+12000`
- `-8000`
- `small win`

#### 4.6 Saving behavior

Buttons:

- `Save Hand`
- `Save & New`

Rules:

- Saving updates `updatedAt`
- If the hand already exists in the session, it is replaced by matching `id`
- If not, it is appended to the end of the session hand list
- `Save Hand` returns to session detail
- `Save & New` returns to live mode for another hand

Important current behavior:

- In `Save & New`, the saved data is correct, but the local `setDraft(newHand())` is effectively not used because the parent screen reloads live mode with a fresh blank hand.

### 5. Export Screen

Purpose:

- produce AI-friendly plain text for copy/paste
- download the text as `.txt`

Modes:

1. `all`
2. `summary`
3. `hands`

Actions:

- `Copy All`
- `Download .txt`
- `Copy Summary`
- `Copy Hands`

Download behavior:

- Filename pattern: `poker-session-YYYYMMDDHHMM.txt`
- Timestamp source: `session.dateTime` if present, otherwise current local time

## Export Format Spec

### Summary block

```txt
Session:
Date: {dateTime with T replaced by space}
Place: {place}
Stake: {stake}
Buy-in: {buyIn}
Rebuy/Add-on: {rebuy}
Cash-out: {cashOut}
Rake: {rakeMemo}

Player Notes:
{playerNotesText}

Session Memo:
{sessionMemo}
```

### Hands block

For each hand:

```txt
{index})
Hero: {heroPosition} / {heroHand} ({exactHeroHand if present})
PF: {preflop action summary}
Flop: {formatted flop} / {flop action summary}
Turn: {formatted turn} / {turn action summary}
River: {formatted river} / {river action summary}
Board Tags: {joined tags}
Result: {result}
Amount: {amountMemo}
Memo: {handMemo}
```

Notes:

- The slash after street board is only included if board text exists for that street.
- Empty values are exported as empty strings in many fields, not normalized placeholders.

## Text Formatting Helpers Used by the UI

### Action summary format

Each action is formatted as:

```txt
{position} {action}{optional space + size}
```

Street actions are joined by:

```txt
 /
```

### Hand summary format

The compact in-app hand summary uses:

- Hero line: `{heroPosition or "-"} / {heroHand or "-"}`
- Board summary:
  - `Flop ...`
  - `Turn ...`
  - `River ...`
- Action summary:
  - `PF ... | F ... | T ... | R ...`

## Non-Features in the Current Active UI

The following are **not** active in the current main UI:

- user accounts
- cloud-backed session list
- normalized players table
- normalized venues table
- normalized stakes / rate presets in UI
- calculated pot tracking
- calculated rake tracking
- seat-based action ordering automation
- button seat tracking in UI
- showdown modeling in UI
- BB-based profit calculations in UI
- Supabase sync button / flow in UI
- Dexie-based storage in UI

## Implemented but Not Wired Into the Current Main UI

These files exist, but they are not the source of truth for the currently rendered app flow:

- `/src/lib/types.ts`
- `/src/lib/constants.ts`
- `/src/lib/db.ts`
- `/src/lib/poker.ts`
- `/src/lib/sync.ts`
- `/src/lib/supabase.ts`
- `/supabase/schema.sql`

### What these files represent

- `/src/lib/types.ts`: richer future domain model
- `/src/lib/db.ts`: Dexie schema for IndexedDB
- `/src/lib/sync.ts`: Supabase upload helper
- `/src/lib/poker.ts`: domain helpers for positions, amounts, rake, and player stats
- `/supabase/schema.sql`: intended cloud schema

### How AI agents should treat them

- Use them as indicators of planned direction.
- Do not claim that these capabilities are available in the current UI unless they are explicitly wired from `PokerLogApp.tsx`.

## PWA Metadata

- App name: `ポーカープレーログ`
- Short name: `Poker Log`
- Display mode: `standalone`
- Start URL: `/`

## Test Coverage Present in Repository

Current test file:

- `/tests/action-state.test.mjs`

Covered themes:

- action append order
- ability to save hand notes without numeric bet amounts
- board text formatting
- export text structure
- player notes parsing helpers (including seat 10 labels)
- player notes auto-save semantics
- seat move/transfer logic (`transferSeatNotes`)

Important note:

- These tests duplicate behavior in standalone test helpers.
- They do not verify the live React component directly.

## AI Consumption Guidance

If an AI agent needs to modify this app safely, assume the following:

- The main product today is a **fast local memo tool**, not a fully normalized poker database.
- Backward compatibility with `localStorage` key `poker-log-fast-v1` matters.
- Free text is intentional in many fields.
- Speed of input is prioritized over validation strictness.
- `heroHand` format is mixed and must be handled carefully.
- Seat notes are stored as text, not structured records.

## Recommended Change Safety Rules

Before changing behavior, preserve these unless the product decision explicitly changes:

- session list must remain usable with zero setup
- new session creation must be one tap
- hand entry must work without numeric sizing
- export must remain plain text and easy to paste into AI tools
- deleting a session or hand must remove it from local storage immediately

