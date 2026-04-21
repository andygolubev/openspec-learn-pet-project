import { closePool } from "./pool.js";
import { runMigrations } from "./runMigrations.js";

async function run() {
  await runMigrations();
  console.log("Migrations applied.");
  await closePool();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
