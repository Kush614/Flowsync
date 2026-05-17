import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = resolve(process.cwd(), "../../examples/sample-openapi.json");
  const text = await readFile(p, "utf8");
  return new NextResponse(text, { headers: { "content-type": "application/json" } });
}
