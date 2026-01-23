// /api/details.js
// Vercel Serverless Function (Node) - Debuggable proxy for recipe details via APILayer

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
    const id = (searchParams.get("id") || "").trim();
    const includeNutrition = (searchParams.get("includeNutrition") || "false").trim();

    console.log("[details] id:", id);
    console.log("[details] includeNutrition:", includeNutrition);

    if (!id) {
      return res.status(400).json({ error: "Missing required query param: id" });
    }

    const API_KEY = process.env.APILAYER_KEY;
    console.log("[details] has APILAYER_KEY:", Boolean(API_KEY));

    if (!API_KEY) {
      return res.status(500).json({
        error: "Missing APILAYER_KEY environment variable on Vercel",
        hint: "Set Project Settings → Environment Variables → APILAYER_KEY, then redeploy",
      });
    }

    const upstreamUrl =
      `https://api.apilayer.com/spoonacular/recipes/${encodeURIComponent(id)}/information` +
      `?includeNutrition=${encodeURIComponent(includeNutrition)}`;

    console.log("[details] upstreamUrl:", upstreamUrl);

    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: { apikey: API_KEY },
    });

    const upstreamText = await upstreamRes.text();

    console.log("[details] upstreamStatus:", upstreamRes.status);
    console.log(
      "[details] upstreamHeaders:",
      JSON.stringify(Object.fromEntries(upstreamRes.headers.entries()))
    );
    console.log("[details] upstreamBody (first 4000 chars):", upstreamText.slice(0, 4000));

    // Success pass-through
    if (upstreamRes.ok) {
      res.status(200).setHeader("Content-Type", "application/json").send(upstreamText);
      return;
    }

    // Error: return structured debug payload
    res.status(upstreamRes.status).json({
      error: "Upstream API error (APILayer/Spoonacular)",
      upstreamStatus: upstreamRes.status,
      upstreamHeaders: Object.fromEntries(upstreamRes.headers.entries()),
      upstreamBody: safeJsonOrText(upstreamText),
    });
  } catch (err) {
    console.error("[details] proxy crashed:", err);

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
