-- OFFICE BARDAGULAN 2100 - Complete Database Schema
-- Apply this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Game Rooms
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(8) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'paused', 'finished', 'expired')),
  current_question_id VARCHAR(20),
  current_question_index INTEGER DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{
    "questionCount": 20,
    "categories": ["office_kalokohan", "lovelife_edition", "walang_takas"],
    "votingTimer": 30,
    "mode": "quick",
    "randomize": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_game_rooms_code ON game_rooms(code);
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_expires ON game_rooms(expires_at);

-- Room Participants (anonymous)
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  session_token VARCHAR(64) NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, nickname)
);

CREATE INDEX idx_participants_room ON room_participants(room_id);
CREATE INDEX idx_participants_token ON room_participants(session_token);

-- Questions (seeded from local data)
CREATE TABLE questions (
  id VARCHAR(20) PRIMARY KEY,
  category VARCHAR(50) NOT NULL CHECK (category IN ('office_kalokohan', 'lovelife_edition', 'walang_takas')),
  question TEXT NOT NULL,
  humor_tags TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_category ON questions(category);

-- Game Sessions / State
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  question_ids TEXT[] NOT NULL DEFAULT '{}',
  current_index INTEGER NOT NULL DEFAULT 0,
  votes_revealed BOOLEAN NOT NULL DEFAULT FALSE,
  voting_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sessions_room ON game_sessions(room_id);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  question_id VARCHAR(20) NOT NULL,
  participant_id UUID NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE,
  candidate_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, question_id, participant_id)
);

CREATE INDEX idx_votes_room_question ON votes(room_id, question_id);
CREATE INDEX idx_votes_participant ON votes(participant_id);

-- Played Questions History
CREATE TABLE played_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  question_id VARCHAR(20) NOT NULL,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_played_room ON played_questions(room_id);

-- RLS Policies
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE played_questions ENABLE ROW LEVEL SECURITY;

-- Questions are public read
CREATE POLICY "Questions are viewable by everyone" ON questions
  FOR SELECT USING (true);

-- Rooms: anyone can create, read by code
CREATE POLICY "Anyone can create rooms" ON game_rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view rooms by code" ON game_rooms
  FOR SELECT USING (true);

CREATE POLICY "Host can update own room" ON game_rooms
  FOR UPDATE USING (true); -- Further restricted in app logic via host_id check

-- Participants
CREATE POLICY "Anyone can join as participant" ON room_participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Participants can view room mates" ON room_participants
  FOR SELECT USING (true);

CREATE POLICY "Participants can update own last_seen" ON room_participants
  FOR UPDATE USING (true);

-- Votes: insert only, select after reveal controlled in app
CREATE POLICY "Participants can cast votes" ON votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Votes viewable after reveal (app controlled)" ON votes
  FOR SELECT USING (true);

-- Sessions
CREATE POLICY "Anyone can view sessions" ON game_sessions
  FOR SELECT USING (true);

CREATE POLICY "Host can manage sessions" ON game_sessions
  FOR ALL USING (true);

-- Played
CREATE POLICY "Anyone can view played" ON played_questions
  FOR SELECT USING (true);

CREATE POLICY "Host can insert played" ON played_questions
  FOR INSERT WITH CHECK (true);

-- Function for atomic vote casting
CREATE OR REPLACE FUNCTION cast_vote(
  p_room_id UUID,
  p_question_id VARCHAR,
  p_participant_id UUID,
  p_candidate VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_exists BOOLEAN;
  v_room_status VARCHAR;
BEGIN
  SELECT status INTO v_room_status FROM game_rooms WHERE id = p_room_id;
  IF v_room_status NOT IN ('playing', 'paused') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not accepting votes');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM votes 
    WHERE room_id = p_room_id AND question_id = p_question_id AND participant_id = p_participant_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already voted');
  END IF;

  INSERT INTO votes (room_id, question_id, participant_id, candidate_name)
  VALUES (p_room_id, p_question_id, p_participant_id, p_candidate);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired rooms function
CREATE OR REPLACE FUNCTION cleanup_expired_rooms() RETURNS void AS $$
BEGIN
  UPDATE game_rooms SET status = 'expired' WHERE expires_at < NOW() AND status != 'expired';
  DELETE FROM game_rooms WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON game_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
