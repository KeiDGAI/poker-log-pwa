"use client";

import Dexie, { type Table } from "dexie";
import { DEFAULT_PLAY_UNITS } from "./constants";
import type { Hand, PlayerProfile, PlayUnit, SavedRate, Session, SessionPlayer, UserProfile, Venue } from "./types";

export class PokerLogDb extends Dexie {
  userProfiles!: Table<UserProfile, string>;
  playUnits!: Table<PlayUnit, string>;
  venues!: Table<Venue, string>;
  savedRates!: Table<SavedRate, string>;
  sessions!: Table<Session, string>;
  playerProfiles!: Table<PlayerProfile, string>;
  sessionPlayers!: Table<SessionPlayer, string>;
  hands!: Table<Hand, string>;

  constructor() {
    super("poker-log-pwa");
    this.version(1).stores({
      userProfiles: "id",
      playUnits: "id, name, country",
      venues: "id, country, name, lastUsedAt",
      savedRates: "id, venueId, playUnitId, lastUsedAt",
      sessions: "id, date, syncStatus, updatedAt",
      playerProfiles: "id, nickname, updatedAt",
      sessionPlayers: "id, sessionId, playerProfileId, seatNumber, isHero",
      hands: "id, sessionId, handNumber, updatedAt",
    });
  }
}

export const db = new PokerLogDb();

export const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const nowIso = () => new Date().toISOString();

export async function seedDefaults() {
  const count = await db.playUnits.count();
  if (count > 0) return;

  const createdAt = nowIso();
  await db.playUnits.bulkAdd(
    DEFAULT_PLAY_UNITS.map((unit) => ({
      id: uid(),
      createdAt,
      ...unit,
    }))
  );
}
