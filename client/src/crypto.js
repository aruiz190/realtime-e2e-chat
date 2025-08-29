import sodium from "libsodium-wrappers";

// Simple E2E helpers
export const cryptoReady = sodium.ready;

export function generateKeyPair() {
  const { publicKey, privateKey } = sodium.crypto_kx_keypair();
  return {
    publicKey,
    privateKey,
    publicKeyBase64: sodium.to_base64(publicKey)
  };
}

// Derive shared key using X25519 (one-way for chat)
// We'll use crypto_kx with fixed roles to get a symmetric key.
export function deriveSharedKey(myKeys, peerPublicKey) {
  // Pretend we are the "client" role deterministically
  const { sharedTx, sharedRx } = sodium.crypto_kx_client_session_keys(
    myKeys.publicKey, myKeys.privateKey, peerPublicKey
  );
  // We'll just use one of them as the secretbox key (32 bytes)
  return sharedTx; // Uint8Array(32)
}

export function encryptMessage(key, plaintext) {
  const msg = sodium.from_string(plaintext);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const box = sodium.crypto_secretbox_easy(msg, nonce, key);
  // pack nonce + box for transport
  return sodium.to_base64(sodium.concat(nonce, box));
}

export function decryptMessage(key, ciphertextBase64) {
  try {
    const combined = sodium.from_base64(ciphertextBase64);
    const nonceBytes = sodium.crypto_secretbox_NONCEBYTES;
    const nonce = combined.slice(0, nonceBytes);
    const box = combined.slice(nonceBytes);
    const opened = sodium.crypto_secretbox_open_easy(box, nonce, key);
    return sodium.to_string(opened);
  } catch {
    return "[decrypt error]";
  }
}
