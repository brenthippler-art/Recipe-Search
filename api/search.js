// /api/search.js
// Vercel Serverless Function (Node) - Debuggable proxy for Spoonacular via APILayer

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // Use WHATWG URL API (avoids url.parse deprecation)
    const { searchParams } = new URL(req.url, "http://localhost");
    const q = (searchParams.get("q") || "").trim();
    const number = (searchParams.get("number") || "12").trim();

    console.log("[search] q:", q);
    console.log("[search] number:", number);

    if (!q) {
      return res.status(400).json({ error: "Missing required query param: q" });
    }

    const API_KEY = process.env.APILAYER_KEY;
    console.log("[search] has APILAYER_KEY:", Boolean(API_KEY));

    if (!API_KEY) {
      return res.status(500).json({
        error: "Missing APILAYER_KEY environment variable on Vercel",
        hint: "Set Project Settings → Environment Variables → APILAYER_KEY, then redeploy",
      });
    }

    // Build upstream URL
    const upstreamUrl =
      "https://api.apilayer.com/spoonacular/recipes/complexSearch" +
      `?query=${encodeURIComponent(q)}` +
      `&addRecipeNutrition=true` +
      `&number=${encodeURIComponent(number)}`;

    console.log("[search] upstreamUrl:", upstreamUrl);

    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: { apikey: API_KEY },
    });

    const upstreamText = await upstreamRes.text();

    console.log("[search] upstreamStatus:", upstreamRes.status);
    console.log(
      "[search] upstreamHeaders:",
      JSON.stringify(Object.fromEntries(upstreamRes.headers.entries()))
    );
    console.log("[search] upstreamBody (first 4000 chars):", upstreamText.slice(0, 4000));

    // Success: pass through JSON exactly
    if (upstreamRes.ok) {
      res.status(200).setHeader("Content-Type", "application/json").send(upstreamText);
      return;
    }

    // Error: return structured debug payload to client
    res.status(upstreamRes.status).json({
      error: "Upstream API error (APILayer/Spoonacular)",
      upstreamStatus: upstreamRes.status,
      upstreamHeaders: Object.fromEntries(upstreamRes.headers.entries()),
      upstreamBody: safeJsonOrText(upstreamText),
    });
  } catch (err) {
    console.error("[search] proxy crashed:", err);

    res.status(500).json({
      error: "Proxy crashed",
      details: String(err?.stack || err),
    });
  }
}

function safeJsonOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
