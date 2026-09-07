-- Migration v2: Option A multi-client support
-- Add label and provider_type columns to integrations
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '';
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS provider_type text;
UPDATE integrations SET provider_type = id WHERE provider_type IS NULL;

-- Add integration_id to oauth_states (ties a state to the specific integration used)
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS integration_id text;
UPDATE oauth_states SET integration_id = provider WHERE integration_id IS NULL;

-- Add integration_id to accounts (needed for token refresh with correct app credentials)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS integration_id text;
UPDATE accounts SET integration_id = provider WHERE integration_id IS NULL;
