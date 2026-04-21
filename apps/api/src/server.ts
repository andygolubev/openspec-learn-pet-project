import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main() {
  const app = await buildApp();
  const config = loadConfig();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`API listening on ${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
