#!/bin/sh
set -e
cd /app/apps/api
node dist/db/migrate.js
exec node dist/server.js
