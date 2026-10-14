/**
 * Startet Next.js zusammen mit dem WebSocket-Server für Live-Chats.
 *   Entwicklung: npm run dev   ·   Produktion: npm start (nach npm run build)
 */
import { createServer } from "node:http";
import next from "next";
import { attachRealtime } from "@/realtime/ws-server";

const port = Number.parseInt(process.env.PORT || "3000", 10);
// Nicht HOSTNAME verwenden: Docker setzt dort die Container-ID
const hostname = process.env.LISTEN_HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    void handle(req, res);
  });
  attachRealtime(server, dev ? app.getUpgradeHandler() : undefined);
  server.listen(port, hostname, () => {
    console.log(`> Hertlin läuft auf http://localhost:${port} (${dev ? "Entwicklung" : "Produktion"})`);
  });
});
