const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');

const colors = [
    { variant: "Vermillion", hex: "#2E191B" },
    { variant: "Forest", hex: "#0B6623" },
    { variant: "Navy", hex: "#000080" },
    { variant: "Crimson", hex: "#DC143C" },
    { variant: "Sky Blue", hex: "#87CEEB" },
    { variant: "Lime", hex: "#00FF00" },
    { variant: "Gold", hex: "#FFD700" },
    { variant: "Lavender", hex: "#E6E6FA" },
    { variant: "Tangerine", hex: "#F28500" },
    { variant: "Magenta", hex: "#FF00FF" },
    { variant: "Cyan", hex: "#00FFFF" },
    { variant: "Olive", hex: "#808000" },
    { variant: "Teal", hex: "#008080" },
    { variant: "Maroon", hex: "#800000" },
    { variant: "Coral", hex: "#FF7F50" }
];

// ---------------------- Utilities ----------------------
const PORT = process.env.PORT || 3000;

/** Case-insensitive equality */
const eqCi = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Get a random color */
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)]

/** Send HTML with UTF-8 headers */
function sendHtml(res, html, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

/** Send plain text with UTF-8 headers */
function sendText(res, text, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
}

/** Basic HTML page template */
function page({ title = 'Servidor de colores', body = '' }) {
    return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root{color-scheme: light dark}
        body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial; margin:2rem; line-height:1.55;}
        a{color:#0F52BA; text-decoration:none}
        a:hover{text-decoration:underline}
        ul{padding-left:1.2rem}
        code,kbd{background:#0001; padding:.15rem .35rem; border-radius:4px}
        .muted{color:#0008}
        .swatch{display:inline-block; width:1.1rem; height:1.1rem; border-radius:4px; vertical-align:middle; margin-right:.5rem; border:1px solid #0001;}
        img{max-width:100%; height:auto; border-radius:8px; box-shadow:0 2px 10px #0002}
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

/** Load animals.json and find by variant (case-insensitive) */
async function findAnimalByVariant(variant) {
    const jsonPath = path.resolve(__dirname, 'files', 'animals.json');
    const file = await fs.readFile(jsonPath, 'utf-8');
    const animals = JSON.parse(file);
    if (!Array.isArray(animals)) return undefined;
    return animals.find(a => a?.variant && eqCi(a.variant, variant));
}

// ---------------------- HTTP Server ----------------------
const server = http.createServer(async (req, res) => {
    // Only allow GET for this simple API
    if (req.method !== 'GET') {
        return sendText(res, 'Method Not Allowed', 405);
    }

    // Parse URL and query params
    const { pathname = '/', query = {} } = url.parse(req.url, true);

    // Root: welcome 
    if (pathname === '/') {
        const html = page({
            title: 'Bienvenidos',
            body: `
          <h1>👋 Bienvenidos al servidor de colores de NetMind</h1>
          <p>Rutas disponibles:</p>
          <ul>
            <li><code>/color</code> — Devuelve el <strong>primer</strong> color del array (texto plano).</li>
            <li><code>/color?variant=Vermillion</code> — Devuelve el color indicado; si no existe, uno <em>aleatorio</em>.</li>
            <li><code>/get-colors</code> — Lista HTML de colores (clicables).</li>
            <li><code>/get-animal?variant=Vermillion</code> — Imagen de un animal relacionado con el color.</li>
          </ul>
        `
        });
        return sendHtml(res, html);
    }

    // /color: plain text hex
    if (pathname === '/color') {
        // Normalize variant from query (string or empty)
        const variant = query?.variant != null ? String(query.variant).trim() : '';

        if (variant) {
            const found = colors.find(color => eqCi(color.variant, variant));
            const chosen = found || getRandomColor(); // random if not found.
            return sendHtml(res, `<p style="color:${chosen.hex}">${chosen.hex}</p>`);
        }

        // No variant provided -> random color
        const randomColor = getRandomColor();
        return sendHtml(res, `<p style="color:${randomColor.hex}">${randomColor.hex}</p>`);
    }

    // /get-colors: clickable HTML list
    if (pathname === "/get-colors") {
        const items = colors.map(
            c =>
                `<li>
                <a href="/color?variant=${encodeURIComponent(c.variant)}">
                  <span class="swatch" style="background:${c.hex}"></span>${c.variant}
                  <span class="muted">${c.hex}</span>
                </a>
                &nbsp;— <a class="muted" href="/get-animal?variant=${encodeURIComponent(
                    c.variant
                )}">ver animal</a>
              </li>`
        ).join('\n');

        const html = page({
            title: 'Colores disponibles',
            body: `
            <h1>Colores disponibles</h1>
            <p>Haz clic en un color para solicitarlo al servidor.</p>
            <ul>${items}</ul>
            <p class="muted">También puedes usar <kbd>/color</kbd> o <kbd>/color?variant=Vermillion</kbd>.</p>
            <p><a href="/">Volver</a></p>
            `
        });

        return sendHtml(res, html);
    }

    // /get-animal: requires ?variant=...
    if (pathname === '/get-animal') {
        const variant = query?.variant != null ? String(query.variant).trim() : '';

        if (!variant) {
            const html = page({
                title: 'Falta parámetro',
                body: `
                <h1>Falta el parámetro <code>variant</code></h1>
                <p>Ejemplo: <code>/get-animal?variant=Vermillion</code></p>
                <p><a href="/">Volver</a></p>`
            });
            return sendHtml(res, html, 400);
        }

        // read .json
        try {
            const animal = await findAnimalByVariant(variant);
            if (!animal) {
                const html = page({
                    title: 'No encontrado',
                    body: `
                    <h1>Animal no encontrado para <code>${variant}</code></h1>
                    <p>Prueba con otra variante desde <a href="/get-colors">la lista de colores</a>.</p>
                    <p><a href="/">Volver</a></p>`
                });
                return sendHtml(res, html, 404);
            }

            //Success
            const html = page({
                title: `${animal.animalName} (${animal.variant})`,
                body: `
                <h1>${animal.animalName} <small class="muted">(${animal.variant})</small></h1>
                <p><img width="300" src="${animal.urlImage}" alt="${animal.animalName}"></p>
                <p><a href="/">Volver</a></p>`
            });
            return sendHtml(res, html);
        } catch (err) {
            // JSON load/parse or error
            const html = page({
                title: 'Error del servidor',
                body: `<h1>Error cargando <code>files/animals.json</code></h1>
                       <pre class="muted">${String(err && err.message ? err.message : err)}</pre>
                       <p><a href="/">Volver</a></p>`
              });
            return sendHtml(res, html, 500);
        }
    }

     // Fallback 404
     const html = page({
        title: '404',
        body: `
        <h1>404 - Ruta no encontrada</h1>
        <p><a href="/">Volver</a></p>`
    });
    return sendHtml(res, html, 404);
});

server.listen(PORT, () => {
    console.log(`Escuchando en http://localhost:${PORT}`);
});