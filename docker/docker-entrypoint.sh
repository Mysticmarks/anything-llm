#!/bin/bash

# Check if STORAGE_DIR is set
if [ -z "$STORAGE_DIR" ]; then
    echo "================================================================"
    echo "⚠️  ⚠️  ⚠️  WARNING: STORAGE_DIR environment variable is not set! ⚠️  ⚠️  ⚠️"
    echo ""
    echo "Not setting this will result in data loss on container restart since"
    echo "the application will not have a persistent storage location."
    echo "It can also result in weird errors in various parts of the application."
    echo ""
    echo "Please run the container with the official docker command at"
    echo "https://docs.anythingllm.com/installation-docker/quickstart"
    echo ""
    echo "⚠️  ⚠️  ⚠️  WARNING: STORAGE_DIR environment variable is not set! ⚠️  ⚠️  ⚠️"
    echo "================================================================"
fi

cd /app/server/ &&
  npx prisma generate --schema=./prisma/schema.prisma &&
  npx prisma migrate deploy --schema=./prisma/schema.prisma

if [ "${USE_STACK_MANAGER:-true}" = "true" ]; then
  export DISABLE_FRONTEND_PROCESS="${DISABLE_FRONTEND_PROCESS:-true}"
  export SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-true}"
  cd /app
  exec node ./scripts/start-stack.mjs
else
  {
    node /app/server/index.js
  } &
  { node /app/collector/index.js; } &
  wait -n
  exit $?
fi