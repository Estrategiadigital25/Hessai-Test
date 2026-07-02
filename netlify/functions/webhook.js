// Proxy endurecido hacia el webhook de n8n.
// - La URL de n8n y el secreto viven en variables de entorno de Netlify (invisibles al publico).
// - Agrega la cabecera secreta que n8n exige (Header Auth), asi n8n rechaza cualquier POST directo.
// - Rechaza llamadas desde otros sitios (Origin/Referer) y cuerpos gigantes.
const ALLOWED_HOSTS = ["hessaitest.netlify.app", "hessai.com.co"];
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
  if (hostAllowed(origin) === false || hostAllowed(referer) === false) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  }
  if (event.body && Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: "Payload too large" }) };
  }

  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_SECRET;
  if (!url || !secret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Webhook no configurado" }) };
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hessai-Auth": secret
      },
      body: event.body || "{}"
    });
    return { statusCode: resp.ok ? 200 : 502, headers, body: JSON.stringify({ ok: resp.ok, status: resp.status }) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
