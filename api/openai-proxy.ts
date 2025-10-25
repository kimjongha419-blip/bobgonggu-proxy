// api/openai-proxy.ts
export const config = { runtime: "edge" };

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // 워커와 공유할 비밀 토큰 검사(선택적 보호)
  const expected = process.env.PROXY_SHARED_TOKEN || "";
  const got = req.headers.get("x-proxy-token") || "";
  if (expected && got !== expected) return new Response("Forbidden", { status: 403 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" }
  });
}
