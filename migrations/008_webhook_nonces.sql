-- migrations/008_webhook_nonces.sql

CREATE TABLE webhook_nonces (
  nonce TEXT PRIMARY KEY,
  job_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_nonces_created ON webhook_nonces(created_at);

CREATE OR REPLACE FUNCTION cleanup_old_nonces()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_nonces WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

