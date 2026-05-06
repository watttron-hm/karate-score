#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/production.env"

if [[ ! -f "${ENV_FILE}" ]]; then
    cat >&2 <<EOF
Missing ${ENV_FILE}

Create it with at least:
DEPLOY_HOST=myuser@example.com
DEPLOY_PATH=/opt/karate-score

Optional:
IMAGE_NAME=karate-score
CONTAINER_NAME=karate-score
HOST_PORT=5000
CONTAINER_PORT=5000
EOF
    exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${DEPLOY_HOST:?DEPLOY_HOST is required in ${ENV_FILE}}"
: "${DEPLOY_PATH:?DEPLOY_PATH is required in ${ENV_FILE}}"

IMAGE_NAME="${IMAGE_NAME:-karate-score}"
CONTAINER_NAME="${CONTAINER_NAME:-karate-score}"
HOST_PORT="${HOST_PORT:-5000}"
CONTAINER_PORT="${CONTAINER_PORT:-5000}"

REMOTE="${DEPLOY_HOST}"
REMOTE_RELEASE_DIR="${DEPLOY_PATH}/release"

cd "${PROJECT_DIR}"

echo "Building wheel..."
uv build --wheel

shopt -s nullglob
WHEEL_FILES=(dist/*.whl)
shopt -u nullglob

if (( ${#WHEEL_FILES[@]} == 0 )); then
    echo "No wheel file found in dist/ after build." >&2
    exit 1
fi

WHEEL_FILE="$(ls -t "${WHEEL_FILES[@]}" | head -n 1)"

echo "Preparing remote release directory..."
ssh "${REMOTE}" "mkdir -p '${REMOTE_RELEASE_DIR}/dist' '${REMOTE_RELEASE_DIR}/config'"

echo "Transferring wheel and Docker build files..."
scp "${WHEEL_FILE}" "${REMOTE}:${REMOTE_RELEASE_DIR}/dist/"
scp "${SCRIPT_DIR}/Dockerfile" "${SCRIPT_DIR}/application.toml" "${REMOTE}:${REMOTE_RELEASE_DIR}/config/"

echo "Building Docker image on ${DEPLOY_HOST}..."
ssh "${REMOTE}" "cd '${REMOTE_RELEASE_DIR}' && docker build -f config/Dockerfile -t '${IMAGE_NAME}:latest' ."

echo "Replacing running container..."
ssh "${REMOTE}" "\
    docker stop '${CONTAINER_NAME}' >/dev/null 2>&1 || true; \
    docker rm '${CONTAINER_NAME}' >/dev/null 2>&1 || true; \
    docker run -d \
        --name '${CONTAINER_NAME}' \
        --restart unless-stopped \
        -p '127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}' \
        '${IMAGE_NAME}:latest'"

echo "Deployment complete: ${CONTAINER_NAME} is running on ${DEPLOY_HOST}:${HOST_PORT}"
