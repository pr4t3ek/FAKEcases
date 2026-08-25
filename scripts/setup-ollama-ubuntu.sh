#!/usr/bin/env bash
#
# Set up Ollama on Ubuntu as the local interviewer for CASE CLOSED.
#
# Installs Ollama, brings the server up under systemd, pulls a model, proves the
# OpenAI-compatible endpoint the app actually calls answers, and points
# .env.local at it.
#
# Idempotent: every step checks before it acts, so re-running after a failure
# picks up where it stopped rather than reinstalling. Nothing is overwritten —
# an existing LLM_PROVIDER set to something else is reported, not replaced.
#
#   ./scripts/setup-ollama-ubuntu.sh                  # qwen2.5:7b, writes .env.local
#   ./scripts/setup-ollama-ubuntu.sh --model llama3.2 # smaller and ~2.5x faster
#   ./scripts/setup-ollama-ubuntu.sh --no-env         # set the machine up, leave the repo alone
#
# See docs/OLLAMA_UBUNTU.md for the manual equivalent and the troubleshooting table.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MODEL="qwen2.5:7b"
ENV_FILE="$ROOT/.env.local"
WRITE_ENV=1
UPGRADE=0

# 127.0.0.1 rather than localhost: on a machine with IPv6 the name can resolve to
# ::1 first, where Ollama is not listening, and the failure looks like "not running".
API="http://127.0.0.1:11434"

# Long enough for a cold `systemctl start` on a slow disk, short enough that a
# genuinely broken install is reported rather than waited on.
READY_TIMEOUT=60

bold=$'\033[1m'; dim=$'\033[2m'; red=$'\033[31m'; yellow=$'\033[33m'; green=$'\033[32m'; off=$'\033[0m'
if [ ! -t 1 ]; then bold=""; dim=""; red=""; yellow=""; green=""; off=""; fi

step() { printf '%s==>%s %s\n' "$bold" "$off" "$*"; }
info() { printf '    %s%s%s\n' "$dim" "$*" "$off"; }
ok()   { printf '    %s✓%s %s\n' "$green" "$off" "$*"; }
warn() { printf '    %s!%s %s\n' "$yellow" "$off" "$*" >&2; }
die()  { printf '%serror:%s %s\n' "$red" "$off" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  # The header comment is the help text: it stops at the first non-comment line,
  # so the two never drift apart.
  awk 'NR < 3 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${BASH_SOURCE[0]}"
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --model)    MODEL="${2:-}"; [ -n "$MODEL" ] || die "--model needs a name, e.g. --model llama3.2"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; [ -n "$ENV_FILE" ] || die "--env-file needs a path"; shift 2 ;;
    --no-env)   WRITE_ENV=0; shift ;;
    --upgrade)  UPGRADE=1; shift ;;
    -h|--help)  usage ;;
    *)          die "unknown option: $1 (try --help)" ;;
  esac
done

# ── 1. Preflight ────────────────────────────────────────────────────────────────
step "Checking the machine"

[ "$(uname -s)" = "Linux" ] || die "this script is for Ubuntu/Linux; on macOS or Windows install the Ollama app instead"

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  info "${PRETTY_NAME:-unknown Linux} ($(uname -m))"
  case "${ID:-}:${ID_LIKE:-}" in
    *ubuntu*|*debian*) ;;
    *) warn "not Ubuntu or Debian — the Ollama installer still works, but apt steps below may not" ;;
  esac
fi

# `sudo` is only needed for the install itself and for systemctl, so a machine
# that already has both set up can run this as a plain user with no prompt.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  have sudo || die "sudo not found and not running as root — install sudo, or run this as root"
  SUDO="sudo"
fi

if ! have curl; then
  step "Installing curl (the Ollama installer needs it)"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq curl
  ok "curl installed"
fi

# ── 2. Install Ollama ───────────────────────────────────────────────────────────
step "Installing Ollama"

if have ollama && [ "$UPGRADE" -eq 0 ]; then
  ok "already installed — $(ollama --version 2>/dev/null | head -1)"
  info "re-run with --upgrade to pull the latest release"
else
  # The official installer detects the GPU, creates the `ollama` service user and
  # installs the systemd unit. It calls sudo itself, so it is not run under $SUDO.
  curl -fsSL https://ollama.com/install.sh | sh
  have ollama || die "install finished but \`ollama\` is not on PATH — open a new shell and re-run"
  ok "installed — $(ollama --version 2>/dev/null | head -1)"
fi

# ── 3. Start the server ─────────────────────────────────────────────────────────
step "Starting the Ollama server"

api_up() { curl -fsS --max-time 3 "$API/api/version" >/dev/null 2>&1; }

wait_for_api() {
  local waited=0
  while [ "$waited" -lt "$READY_TIMEOUT" ]; do
    api_up && return 0
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

if api_up; then
  ok "already listening on $API"
elif have systemctl && [ -d /run/systemd/system ]; then
  # The installer enables this unit already; `enable --now` is the idempotent way
  # to cover the case where it was stopped or disabled by hand.
  $SUDO systemctl enable --now ollama >/dev/null 2>&1 || die "could not start the ollama service — see: journalctl -u ollama -n 50"
  wait_for_api || die "service started but $API never answered — see: journalctl -u ollama -n 50"
  ok "systemd service running, and it will come back after a reboot"
else
  # No systemd: a container, or WSL without systemd enabled. Nothing starts the
  # server at boot there, so it is launched detached and that limit is stated.
  warn "no systemd here (container or WSL?) — starting \`ollama serve\` in the background"
  nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
  wait_for_api || die "\`ollama serve\` did not come up — see /tmp/ollama-serve.log"
  ok "running (log: /tmp/ollama-serve.log)"
  warn "this does NOT survive a reboot — re-run \`ollama serve\` after one"
fi

# ── 4. Report the hardware the model will run on ────────────────────────────────
step "Checking acceleration"

if have nvidia-smi && nvidia-smi >/dev/null 2>&1; then
  gpu="$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -1)"
  ok "NVIDIA GPU: ${gpu:-detected}"
elif [ -d /sys/class/kfd ] || have rocminfo; then
  ok "AMD ROCm GPU detected"
else
  ram_gb="$(awk '/MemTotal/ {printf "%.0f", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo "?")"
  warn "no GPU detected — the model runs on CPU (${ram_gb} GB RAM), so a full turn takes tens of seconds"
  info "--model llama3.2 is roughly 2.5x smaller and much faster if that is too slow"
fi

# ── 5. Pull the model ───────────────────────────────────────────────────────────
step "Pulling the model: $MODEL"

# `ollama list` prints "qwen2.5:7b" for a tagged pull; the anchor keeps `qwen2.5:7b`
# from matching a `qwen2.5:7b-instruct` that happens to be installed.
if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL"; then
  ok "already pulled"
else
  info "first pull downloads several GB — this is the slow step"
  ollama pull "$MODEL" || die "pull failed — check the name at https://ollama.com/library"
  ok "pulled"
fi

# ── 6. Prove the endpoint the app calls actually answers ────────────────────────
step "Testing /v1/chat/completions"

# Deliberately the OpenAI-compatible route, not /api/generate: that is the one
# lib/llm/ollama.ts uses, so this fails here rather than in the practice flow.
reply="$(curl -fsS --max-time 180 "$API/v1/chat/completions" \
  -H 'content-type: application/json' \
  -d "{\"model\":\"$MODEL\",\"max_tokens\":24,\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: ready\"}]}" \
  2>/dev/null)" || die "the endpoint did not answer — is the model still loading? re-run in a minute"

case "$reply" in
  *'"choices"'*) ok "the model answered" ;;
  *) die "unexpected response: $(printf '%s' "$reply" | head -c 200)" ;;
esac

# ── 7. Point the app at it ──────────────────────────────────────────────────────
if [ "$WRITE_ENV" -eq 1 ]; then
  step "Configuring $(basename "$ENV_FILE")"

  [ -f "$ENV_FILE" ] || : > "$ENV_FILE"
  # A file that does not end in a newline would otherwise glue the first appended
  # line onto the last existing one. An `if` rather than an `&&` chain because a
  # false chain is a failed statement, and `set -e` would exit on the empty-file case.
  if [ -s "$ENV_FILE" ] && [ "$(tail -c1 "$ENV_FILE" | wc -l)" -eq 0 ]; then
    printf '\n' >> "$ENV_FILE"
  fi

  # Never rewrite a value someone chose: report the conflict and let them decide.
  set_var() {
    local key="$1" value="$2" current
    current="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -1 || true)"
    if [ -z "$current" ]; then
      printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
      ok "$key=$value"
    elif printf '%s' "$current" | grep -qE "^[[:space:]]*${key}=\"?${value}\"?[[:space:]]*$"; then
      ok "$key=$value (already set)"
    else
      warn "$key is already set to something else — left alone:"
      warn "  $current"
      warn "  set it to $value by hand to use the local model"
    fi
  }

  set_var LLM_PROVIDER ollama
  set_var OLLAMA_MODEL "$MODEL"
else
  step "Skipping .env.local (--no-env)"
  info "set LLM_PROVIDER=ollama and OLLAMA_MODEL=$MODEL yourself to use it"
fi

# ── Done ────────────────────────────────────────────────────────────────────────
printf '\n%sOllama is ready.%s\n\n' "$bold" "$off"
cat <<EOF
  Model      $MODEL
  Endpoint   $API/v1  (OLLAMA_BASE_URL, if you ever move it)
  Next       pnpm dev  →  http://localhost:3000

  Watch for the "offline interviewer" badge in a practice chat: that means the
  turn fell back to the mock, and the dev-server log names the reason.

  Service:   systemctl status ollama · journalctl -u ollama -f
  Docs:      docs/OLLAMA_UBUNTU.md
EOF
