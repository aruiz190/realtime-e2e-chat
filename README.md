# Realtime E2E Chat

A minimal **end-to-end encrypted** chat: React + Socket.IO, with client-side X25519 key exchange and XSalsa20-Poly1305 authenticated encryption (libsodium). The server only relays ciphertext and public keys.

## Why it matters
- ✅ True E2E: keys are generated in the browser.
- 🕵️ Zero access: server is a dumb relay—no plaintext.
- ⚡ Realtime: low-latency Socket.IO events.

## Architecture
- **Client** (React, libsodium-wrappers)
  - Generates X25519 key pair on load
  - Exchanges public keys via Socket.IO
  - Derives per-peer shared secret
  - Encrypts with `crypto_secretbox` (XSalsa20-Poly1305)
- **Server** (Node, Express, Socket.IO)
  - Broadcasts public keys and ciphertext to room
  - Never decrypts

