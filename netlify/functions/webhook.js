exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };
  try {
    const response = await fetch("https://hook.us2.make.com/y7mcbpeo1js4jea36dlf84mvy6plp3hy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
```

Haz clic en **Commit changes**.

---

**Paso 2 — Actualiza el index.html en GitHub**

En el archivo `index.html`, busca esta línea:
```
await fetch(WEBHOOK,
```
Y reemplázala por:
```
await fetch("/.netlify/functions/webhook",
