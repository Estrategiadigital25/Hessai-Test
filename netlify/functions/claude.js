// Proxy endurecido hacia la API de Anthropic.
// - Fuerza el modelo y limita max_tokens en el servidor (el cliente no puede pedir Opus ni respuestas gigantes).
// - Rechaza llamadas desde otros sitios (Origin/Referer fuera de la lista).
// - Limita el tamano del cuerpo para evitar abuso por entradas enormes.
const ALLOWED_HOSTS = ["hessaitest.netlify.app", "hessai.com.co"];
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS_CAP = 800;
const MAX_BODY_BYTES = 50 * 1024;

// null = cabecera ausente, true = permitido, false = presente pero no permitido
function hostAllowed(url) {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    return ALLOWED_HOSTS.some(a => h === a || h.endsWith("." + a));
  } catch {
    return false;
  }
}

exports.handler = async function(event) {
  const origin = event.headers.origin || "";
  const referer = event.headers.referer || event.headers.referrer || "";

  const corsOrigin = hostAllowed(origin) ? origin : "https://hessaitest.netlify.app";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Bloquear otros sitios. Ausente = se permite (mismo origen / no-referrer); el tope de modelo/tokens sigue aplicando.
  if (hostAllowed(origin) === false || hostAllowed(referer) === false) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  }

  if (event.body && Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: "Payload too large" }) };
  }

  let incoming;
  try {
    incoming = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!Array.isArray(incoming.messages) || incoming.messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing messages" }) };
  }

  // Solo se reenvia lo permitido: modelo forzado, tokens con tope, y system/messages del cliente.
  const safeBody = {
    model: MODEL,
    max_tokens: Math.min(Number(incoming.max_tokens) || 600, MAX_TOKENS_CAP),
    messages: incoming.messages
  };
  if (incoming.system) safeBody.system = incoming.system;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31"
      },
      body: JSON.stringify(safeBody)
    });
    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
