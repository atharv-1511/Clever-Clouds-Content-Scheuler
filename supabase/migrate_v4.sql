-- Migration v4: Clients table and related integration associations
CREATE TABLE IF NOT EXISTS clients (
    id text PRIMARY KEY,
    name text NOT NULL,
    address text,
    phone text,
    social_urls text,
    created text NOT NULL,
    updated text NOT NULL
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE integrations ADD COLUMN IF NOT EXISTS client_id text;
