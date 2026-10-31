#!/usr/bin/env bash
# Proves a built image is a working release: the compiled migrate and seed commands
# run, the server boots as a non-root user, reports healthy, serves the web app and
# the API against a real PostgreSQL, and stops cleanly on SIGTERM.
#
#   scripts/smoke-image.sh poker-range-trainer:smoke
set -euo pipefail

image="${1:?usage: scripts/smoke-image.sh <image>}"
suffix="prt-smoke-$$"
network="$suffix"
database="$suffix-db"
app="$suffix-app"
port=3901
base="http://127.0.0.1:$port"
origin='https://trainer.example.test'
database_url="postgresql://smoke@$database:5432/smoke"

cleanup() {
  docker rm --force "$app" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "smoke: $1" >&2
  docker logs "$app" 2>&1 | tail -30 >&2 || true
  exit 1
}

wait_until() {
  local description="$1"
  shift
  for _ in $(seq 1 60); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "timed out waiting for $description"
}

docker network create "$network" >/dev/null
docker run --detach --name "$database" --network "$network" \
  --env POSTGRES_USER=smoke --env POSTGRES_DB=smoke \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
wait_until 'PostgreSQL' docker exec "$database" pg_isready --username smoke --dbname smoke \
  --host 127.0.0.1

for step in migrate seed; do
  docker run --rm --network "$network" --env DATABASE_URL="$database_url" "$image" \
    node "packages/database/dist/$step.js"
done

docker run --detach --name "$app" --network "$network" --publish "127.0.0.1:$port:3001" \
  --env DATABASE_URL="$database_url" --env API_ORIGINS="$origin" --env TRUST_PROXY=1 \
  "$image" >/dev/null

[ "$(docker exec "$app" id -u)" != 0 ] || fail 'the server runs as root'
wait_until 'readiness' curl --fail --silent "$base/api/v1/health/ready"
health() { [ "$(docker inspect --format '{{.State.Health.Status}}' "$app")" = healthy ]; }
wait_until 'the container health check' health

curl --fail --silent "$base/app/today" | grep --quiet '<div id="root"></div>' ||
  fail 'the server did not answer a page URL with the app'
script="$(curl --fail --silent "$base/" | sed -n 's/.*src="\(\/assets\/[^"]*\)".*/\1/p' | head -1)"
curl --fail --silent --output /dev/null "$base$script" || fail 'the bundle script is missing'

status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/json' --header "Origin: $origin" \
  --header 'X-Forwarded-Proto: https' --header 'X-Forwarded-For: 203.0.113.9' \
  --data '{"email":"smoke@example.test","password":"smoke-password-1"}' \
  "$base/api/v1/auth/register")"
[ "$status" = 201 ] || fail "registering answered $status"

# Twice, as a process-group kill does: the repeat must not cut the drain short.
docker kill --signal SIGTERM "$app" >/dev/null
docker stop --time 15 "$app" >/dev/null
code="$(docker inspect --format '{{.State.ExitCode}}' "$app")"
[ "$code" = 0 ] || fail "the server exited with $code on SIGTERM"

echo 'smoke: image passed'
