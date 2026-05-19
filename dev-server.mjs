/**
 * Minimal static server so http:// URLs work when testing (Cursor browser blocks file://).
 * Usage: `"path/to/node" dev-server.mjs`
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8787;

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".svg", "image/svg+xml"],
  [".otf", "font/otf"],
]);

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    else if (urlPath.endsWith("/")) urlPath += "index.html";
    let filePath = path.normalize(path.join(ROOT, "." + urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      await fs.access(filePath);
    } catch {
      const asDir = path.join(filePath, "index.html");
      if (asDir.startsWith(ROOT)) {
        try {
          await fs.access(asDir);
          filePath = asDir;
        } catch {
          /* fall through to 404 */
        }
      }
    }
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": types.get(ext) ?? "application/octet-stream",
    });
    res.end(data);
  } catch (_e) {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`http://127.0.0.1:${PORT}/`);
  console.log(`  roulette: http://127.0.0.1:${PORT}/roulette/`);
});
