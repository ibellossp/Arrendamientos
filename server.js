// Servidor de la app de arrendamientos.
// Sirve la página, entrega la configuración pública de Supabase
// y hace de intermediario con la API de Anthropic (la clave nunca llega al navegador).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT) || 3000;
const { SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY } = process.env;
const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MODELO_RAPIDO = process.env.ANTHROPIC_MODEL_RAPIDO || "claude-haiku-5-5";
const html = await readFile(new URL("./public/index.html", import.meta.url));

const json = (res, status, obj) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
};

const leerCuerpo = (req, max) => new Promise((ok, mal) => {
  let n = 0; const partes = [];
  req.on("data", c => { n += c.length; if (n > max) { mal(Object.assign(new Error("muy grande"), { status: 413 })); req.destroy(); } else partes.push(c); });
  req.on("end", () => ok(Buffer.concat(partes)));
  req.on("error", mal);
});

async function claude(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ANTHROPIC_API_KEY) return json(res, 500, { error: "Falta configuración en el servidor" });

  // Solo usuarios con sesión iniciada en Supabase
  const usuario = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { Authorization: req.headers.authorization || "", apikey: SUPABASE_ANON_KEY },
  });
  if (!usuario.ok) return json(res, 401, { error: "no_autorizado" });

  let body;
  try { body = JSON.parse(await leerCuerpo(req, 30 * 1024 * 1024)); }
  catch (e) { return json(res, e.status || 400, { error: "pedido inválido" }); }
  const prompt = String(body.prompt || "").slice(0, 400000);
  const images = Array.isArray(body.images) ? body.images.slice(0, 10) : [];
  if (!prompt) return json(res, 400, { error: "pedido vacío" });

  const corte = new AbortController();
  res.on("close", () => corte.abort());
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: corte.signal,
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: body.rapido ? MODELO_RAPIDO : MODELO,
      max_tokens: 16000,
      stream: true,
      messages: [{ role: "user", content: [
        ...images.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
        { type: "text", text: prompt },
      ] }],
    }),
  });
  if (!r.ok) {
    let msg = "error de la API";
    try { msg = (await r.json()).error?.message || msg; } catch {}
    return json(res, r.status, { error: msg });
  }
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no" });
  Readable.fromWeb(r.body).on("error", () => res.end()).pipe(res);
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/api/config") return json(res, 200, { url: SUPABASE_URL || "", anon: SUPABASE_ANON_KEY || "" });
    if (pathname === "/api/claude") return await claude(req, res);
    if (pathname === "/salud") { res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok"); }
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Método no permitido" });
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : html);
  } catch (e) {
    if (e && e.name === "AbortError") return;
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "error interno" }); else res.end();
  }
}).listen(PORT, () => console.log("Arrendamientos escuchando en el puerto " + PORT));
