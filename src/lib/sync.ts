"use client";

import { supabase } from "./supabase";
import type { Hand, Session, SessionPlayer } from "./types";

export async function uploadSessionBundle(session: Session, players: SessionPlayer[], hands: Hand[]) {
  if (!supabase) {
    return { ok: false, reason: "Supabaseの環境変数が未設定です。" };
  }

  const { error: sessionError } = await supabase.from("sessions").upsert({
    id: session.id,
    date: session.date,
    country: session.country,
    venue_id: session.venueId,
    venue_name: session.venueName,
    play_unit_id: session.playUnitId,
    play_unit_name: session.playUnitName,
    rate_label: session.rateLabel,
    small_blind_amount: session.smallBlindAmount,
    big_blind_amount: session.bigBlindAmount,
    amount_input_unit: session.amountInputUnit,
    start_stack_amount: session.startStackAmount,
    end_stack_amount: session.endStackAmount,
    rake_percent: session.rakePercent,
    rake_cap_bb: session.rakeCapBb,
    memo: session.memo,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  });
  if (sessionError) return { ok: false, reason: sessionError.message };

  const { error: playersError } = await supabase.from("session_players").upsert(
    players.map((player) => ({
      id: player.id,
      session_id: player.sessionId,
      player_profile_id: player.playerProfileId,
      display_name: player.displayName,
      seat_number: player.seatNumber,
      is_hero: player.isHero,
      is_active: player.isActive !== false,
      joined_at_game_number: player.joinedAtGameNumber,
      left_at_game_number: player.leftAtGameNumber,
      left_at: player.leftAt,
      session_notes: player.sessionNotes,
      session_tendencies: player.sessionTendencies,
      seat_history: player.seatHistory,
      created_at: player.createdAt,
      updated_at: player.updatedAt,
    }))
  );
  if (playersError) return { ok: false, reason: playersError.message };

  const { error: handsError } = await supabase.from("hands").upsert(
    hands.map((hand) => ({
      id: hand.id,
      session_id: hand.sessionId,
      hand_number: hand.handNumber,
      participants: hand.participants,
      board: hand.board,
      actions: hand.actions,
      result_text: hand.resultText,
      moved_bb: hand.movedBb,
      pot_amount: hand.potAmount,
      rake_amount: hand.rakeAmount,
      memo: hand.memo,
      created_at: hand.createdAt,
      updated_at: hand.updatedAt,
    }))
  );
  if (handsError) return { ok: false, reason: handsError.message };

  return { ok: true };
}
