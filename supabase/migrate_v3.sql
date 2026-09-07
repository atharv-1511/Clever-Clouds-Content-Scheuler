-- Migration v3: Target posts to specific accounts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS account_ids text;
-- We leave existing posts alone. The UI will require users to re-select accounts when editing them.
