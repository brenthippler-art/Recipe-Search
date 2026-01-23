export default async function handler(req, res) {
  // Always set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // To handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const q = (req.query.q || "").toString().trim();
  const number = (req.query.number || "12").toString();

  if (!q) return res.status(400).json({ error: "Missing q param" });

  const API_KEY = process.env.APILAYER_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Missing APILAYER_KEY env var" });

  const url =
    "https://api.apilayer.com/spoonacular/recipes/complexSearch" +
    `?query=${encodeURIComponent(q)}&addRecipeNutrition=true&number=${encodeURIComponent(number)}`;

  try {
    const r = await fetch(url, { headers: { apikey: API_KEY } });
    const text = await r.text();

    // Keep CORS header on passthrough responses too
    res.status(r.status).setHeader("Content-Type", "application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: "Proxy request failed", details: String(e) });
  }
}
