-- OFFICE BARDAGULAN 2100 - Migration 002: lock down access
--
-- The app talks to Supabase ONLY from Next.js API routes using the service-role key
-- (which bypasses RLS). That lets the server enforce host-only actions and keep
-- votes hidden until the host reveals them. So the browser (anon key) gets no
-- direct table access at all, except for reading the public question bank.
--
-- Run this AFTER 001_initial_schema.sql.

-- Remove the permissive policies from migration 001
DROP POLICY IF EXISTS "Anyone can create rooms" ON game_rooms;
DROP POLICY IF EXISTS "Anyone can view rooms by code" ON game_rooms;
DROP POLICY IF EXISTS "Host can update own room" ON game_rooms;

DROP POLICY IF EXISTS "Anyone can join as participant" ON room_participants;
DROP POLICY IF EXISTS "Participants can view room mates" ON room_participants;
DROP POLICY IF EXISTS "Participants can update own last_seen" ON room_participants;

DROP POLICY IF EXISTS "Participants can cast votes" ON votes;
DROP POLICY IF EXISTS "Votes viewable after reveal (app controlled)" ON votes;

DROP POLICY IF EXISTS "Anyone can view sessions" ON game_sessions;
DROP POLICY IF EXISTS "Host can manage sessions" ON game_sessions;

DROP POLICY IF EXISTS "Anyone can view played" ON played_questions;
DROP POLICY IF EXISTS "Host can insert played" ON played_questions;

-- RLS stays enabled with no policies => anon/authenticated roles are denied.
-- (The "Questions are viewable by everyone" policy from 001 is intentionally kept.)

-- The atomic vote function must not be callable from the browser.
REVOKE EXECUTE ON FUNCTION cast_vote(UUID, VARCHAR, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_expired_rooms() FROM PUBLIC, anon, authenticated;

-- Pausing the voting timer needs to remember how much time was left.
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS paused_remaining_ms INTEGER;
