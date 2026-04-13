import { createAppServer } from "./app.js";
import { logEvent } from "./telemetry/logger.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const server = createAppServer();

server.listen(port, () => {
  logEvent("info", "server_started", { port });
});
