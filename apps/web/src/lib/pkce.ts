function base64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const verifierBytes = new Uint8Array(64);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64urlEncode(verifierBytes.buffer);
  const enc = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const codeChallenge = base64urlEncode(digest);
  return { codeVerifier, codeChallenge };
}

export function randomState(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return base64urlEncode(a.buffer);
}
