#!/bin/bash
export DATABASE_URL="postgresql://allur@localhost:5499/allur_test?host=/tmp"
export OPENAI_API_KEY=sk-test
export OPENAI_BASE_URL=http://localhost:5051/v1
export REVENUECAT_WEBHOOK_SECRET=rc-secret-123
export ADMIN_EMAILS=admin@audit.test
export COMPED_EMAILS=comped@audit.test
export APP_URL=http://localhost:5050
export NODE_ENV=development
export LOG_LEVEL=warn
export PORT=5050
cd "$(dirname "$0")/../../../artifacts/api-server"
exec node dist/index.mjs
