export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const id = (req.query.id || "").toString().trim();
  if (!id) return res.status(400).json({ error: "Missing id param" });

  const API_KEY = process.env.APILAYER_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Missing APILAYER_KEY env var" });

  const url = `https://api.apilayer.com/spoonacular/recipes/${encodeURIComponent(id)}/information?includeNutrition=false`;

  try {
    const r = await fetch(url, { headers: { apikey: API_KEY } });
    const text = await r.text();
    res.status(r.status).setHeader("Content-Type", "application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: "Proxy request failed", details: String(e) });
  }
}
