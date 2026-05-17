export async function verifyNotionSignature(
  secret: string,
  rawBody: string,
  header: string | null
): Promise<boolean> {
  if (!header) {
    console.log("[SIG] no signature header on request");
    return false;
  }
  const expected = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computed = bytesToHex(new Uint8Array(sig));
  const match = timingSafeEqualHex(computed, expected);
  if (!match) {
    console.log("[SIG] MISMATCH");
    console.log("[SIG] header:   ", header.slice(0, 80));
    console.log("[SIG] expected: ", expected.slice(0, 16) + "...");
    console.log("[SIG] computed: ", computed.slice(0, 16) + "...");
    console.log("[SIG] secret:   ", secret.slice(0, 10) + "..." + secret.slice(-4));
    console.log("[SIG] body[:60]:", rawBody.slice(0, 60));
  }
  return match;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
