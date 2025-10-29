// api/openai-proxy.ts
// ✅ Chat Completions API 프록시 (수정됨)
export const config = { runtime: "edge" };

// ✅ 수정: Responses API → Chat Completions API
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export default async function handler(req: Request) {
  // CORS 헤더 설정
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-proxy-token",
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  // POST만 허용
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }), 
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // 워커와 공유할 비밀 토큰 검사 (선택적 보호)
  const expected = process.env.PROXY_SHARED_TOKEN || "";
  const got = req.headers.get("x-proxy-token") || "";
  
  if (expected && got !== expected) {
    console.error("Token mismatch:", { expected: expected ? "***" : "none", got: got ? "***" : "none" });
    return new Response(
      JSON.stringify({ error: "Forbidden - Invalid token" }), 
      { 
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // OpenAI API 키 확인
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set");
    return new Response(
      JSON.stringify({ error: "Missing OPENAI_API_KEY" }), 
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // 요청 본문 파싱
  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    console.error("JSON parse error:", error);
    return new Response(
      JSON.stringify({ error: "Bad JSON" }), 
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // OpenAI API 호출
  try {
    console.log("Calling OpenAI API:", OPENAI_ENDPOINT);
    console.log("Request model:", body.model);
    
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("OpenAI response status:", res.status);

    // 응답 반환 (CORS 헤더 포함)
    return new Response(text, {
      status: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("Content-Type") || "application/json"
      }
    });
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    return new Response(
      JSON.stringify({ 
        error: {
          message: error.message || "Internal server error",
          type: "proxy_error"
        }
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
