/*
  # FairPlay-Scout Database Schema

  1. New Tables
    - `players`
      - `id` (uuid, primary key)
      - `hash` (text, unique) - SHA-256 of username
      - `elo` (integer) - latest official Elo
      - `created_at` (timestamp)
    - `games`
      - `id` (uuid, primary key)
      - `player_id` (uuid, foreign key to players)
      - `site` (text) - Chess.com or Lichess
      - `pgn_url` (text) - URL to stored PGN
      - `date` (date) - game date
      - `result` (text) - game result
      - `created_at` (timestamp)
    - `scores`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key to games)
      - `match_engine_pct` (numeric) - engine match percentage
      - `delta_cp` (numeric) - centipawn delta
      - `run_perfect` (integer) - perfect run streak
      - `ml_prob` (numeric) - ML probability
      - `suspicion_level` (integer) - suspicion level 0-100
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Indexes
    - Index on players.hash for fast lookups
    - Index on scores.ml_prob for sorting
    - Index on scores.suspicion_level for filtering

  4. Realtime
    - Enable realtime broadcasting for scores table
*/

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash text UNIQUE NOT NULL,
  elo integer,
  created_at timestamptz DEFAULT now()
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  site text NOT NULL,
  pgn_url text,
  date date,
  result text,
  created_at timestamptz DEFAULT now()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  match_engine_pct numeric,
  delta_cp numeric,
  run_perfect integer DEFAULT 0,
  ml_prob numeric,
  suspicion_level integer CHECK (suspicion_level >= 0 AND suspicion_level <= 100),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_hash ON players(hash);
CREATE INDEX IF NOT EXISTS idx_scores_ml_prob ON scores(ml_prob DESC);
CREATE INDEX IF NOT EXISTS idx_scores_suspicion_level ON scores(suspicion_level DESC);
CREATE INDEX IF NOT EXISTS idx_games_player_id ON games(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create policies for players table
CREATE POLICY "Allow authenticated users to read players"
  ON players
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage players"
  ON players
  FOR ALL
  TO service_role
  USING (true);

-- Create policies for games table
CREATE POLICY "Allow authenticated users to read games"
  ON games
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage games"
  ON games
  FOR ALL
  TO service_role
  USING (true);

-- Create policies for scores table
CREATE POLICY "Allow authenticated users to read scores"
  ON scores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage scores"
  ON scores
  FOR ALL
  TO service_role
  USING (true);

-- Enable realtime for scores table (now that it exists)
BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
COMMIT;