-- Login limits also count failed password checks per address.
CREATE INDEX idx_login_attempt_ip ON login_attempt(ip, created_at);

-- Open client registration is limited per address.
ALTER TABLE oauth_client ADD COLUMN registered_ip TEXT;
CREATE INDEX idx_oauth_client_created ON oauth_client(created_at);
