// Sealed boxes (X25519 + XSalsa20-Poly1305): anyone can encrypt to a public key, only the holder
// of the secret key can open it. Jobs are sealed to the provider, results to the buyer.
import sodium from "libsodium-wrappers"

export const ready = sodium.ready

export async function newBoxKeys() {
  await sodium.ready
  const { publicKey, privateKey } = sodium.crypto_box_keypair()
  return { publicKey: sodium.to_hex(publicKey), secretKey: sodium.to_hex(privateKey) }
}

export async function seal(json, publicKeyHex) {
  await sodium.ready
  const message = sodium.from_string(JSON.stringify(json))
  return sodium.crypto_box_seal(message, sodium.from_hex(publicKeyHex))
}

/** Opens a sealed box. `cipher` may be bytes or a 0x-hex string as Arkiv returns it. */
export async function open(cipher, keys) {
  await sodium.ready
  const bytes = typeof cipher === "string" ? sodium.from_hex(cipher.replace(/^0x/, "")) : cipher
  const plain = sodium.crypto_box_seal_open(bytes, sodium.from_hex(keys.publicKey), sodium.from_hex(keys.secretKey))
  return JSON.parse(sodium.to_string(plain))
}
