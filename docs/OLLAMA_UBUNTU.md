# Ollama on Ubuntu

Running the CASE CLOSED interviewer on a model on your own machine: free, unmetered, offline,
and no API key to leak. This is the Ubuntu-specific walkthrough — the README's
[Developing against a local model](../README.md#developing-against-a-local-model-ollama) section
covers what the local model is *for* and where it falls short.

Everything here is a config change. No application code changes to run against Ollama.

---

## The short version

```bash
./scripts/setup-ollama-ubuntu.sh
pnpm dev
```

That installs Ollama, starts it under systemd, pulls `qwen2.5:7b`, proves the endpoint the app
actually calls answers, and appends `LLM_PROVIDER=ollama` and `OLLAMA_MODEL=qwen2.5:7b` to
`.env.local`. It is safe to re-run: every step checks before it acts, and a variable already set
to something else is reported rather than overwritten.

```bash
./scripts/setup-ollama-ubuntu.sh --model llama3.2   # smaller, much faster on CPU
./scripts/setup-ollama-ubuntu.sh --no-env           # set the machine up, leave the repo alone
./scripts/setup-ollama-ubuntu.sh --upgrade          # reinstall over an existing Ollama
./scripts/setup-ollama-ubuntu.sh --help
```

**`.env.local` is gitignored** (`.env*.local`), so the setting stays on this machine — which is
the point, since a deployment pointed at a localhost model that isn't there answers every turn
on the mock.

---

## The same thing by hand

```bash
curl -fsSL https://ollama.com/install.sh | sh   # installs the binary + a systemd unit
sudo systemctl enable --now ollama              # the installer already does this; harmless twice
curl http://127.0.0.1:11434                     # expect "Ollama is running"
ollama pull qwen2.5:7b
echo 'LLM_PROVIDER=ollama'      >> .env.local
echo 'OLLAMA_MODEL=qwen2.5:7b'  >> .env.local
pnpm dev
```

Two Ubuntu-specific things the README's cross-platform version doesn't say:

- **The installer starts a systemd service, so you do not run `ollama serve` yourself.** Doing it
  anyway gives `Error: listen tcp 127.0.0.1:11434: bind: address already in use` — which means the
  server is up, not broken. `ollama serve` by hand is for containers and WSL-without-systemd,
  where nothing starts it for you (and where it will not survive a reboot).
- **The service runs as its own `ollama` user**, so pulled models land in
  `/usr/share/ollama/.ollama/models`, not `~/.ollama`. That matters when you go looking for the
  disk they are using.

Use `127.0.0.1` rather than `localhost` when testing by hand. On a dual-stack machine `localhost`
can resolve to `::1` first, where Ollama is not listening, and the refusal looks exactly like a
server that never started.

---

## Which model

`qwen2.5:7b` is the default because it follows the Socratic system prompts in `lib/llm/prompts.ts`
better than the smaller models do. On a CPU-only box it is slow enough to be irritating; drop to
`llama3.2` and you will notice the interviewer getting looser, but the wiring you are debugging
is identical.

| Model | Download | Comfortable on | Notes |
|---|---|---|---|
| `llama3.2` (3B) | ~2 GB | 8 GB RAM, CPU fine | Fastest. Breaks the "don't reveal the answer" rule most often. |
| `qwen2.5:7b` | ~4.7 GB | 16 GB RAM, or any 8 GB GPU | The default. Tens of seconds per turn on CPU. |
| `qwen2.5:14b` | ~9 GB | 12 GB+ VRAM | Closest to hosted quality. Painful without a GPU. |

Switch at any time — pull the model, change `OLLAMA_MODEL`, restart `pnpm dev`:

```bash
ollama pull llama3.2
sed -i 's/^OLLAMA_MODEL=.*/OLLAMA_MODEL=llama3.2/' .env.local
```

`ollama list` shows what is pulled, `ollama rm <model>` reclaims the disk.

---

## How the app finds it

| Variable | Default | What it does |
|---|---|---|
| `LLM_PROVIDER=ollama` | — | **Required.** Ollama is never auto-detected — there is no key to sniff for. |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model to run. Kept separate from `LLM_MODEL` so a leftover `gemini-2.5-flash` is never sent here. |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Any OpenAI-compatible server — LM Studio, vLLM, or Ollama on another box. |

The adapter (`lib/llm/ollama.ts`) calls `/v1/chat/completions` — Ollama's OpenAI-compatible route,
not its native `/api/generate` — and streams the reply. `OLLAMA_BASE_URL` must therefore include
the `/v1`, and it sends **no `authorization` header**, so pointing it at a hosted provider to
borrow the code path 401s.

Next.js reads `.env.local` at boot: **restart `pnpm dev` after changing it.**

### Keep a hosted model in front

A local 7B is a good backstop and a mediocre interviewer. The pairing that gets you both:

```bash
LLM_PROVIDER=nvidia
LLM_FALLBACK_PROVIDER=ollama
```

Hosted NVIDIA answers normally; a rejected key, spent credits or a rate limit hands the turn to
your local model instead of dropping the session to the offline mock. The reverse
(`LLM_PROVIDER=ollama` with a hosted fallback) **turns the spend guards on** and bills real money
the moment your machine's server goes down — see the README's "Keeping a second engine behind the
first".

---

## Managing the service

```bash
systemctl status ollama          # is it up
journalctl -u ollama -f          # what it is doing, live
sudo systemctl restart ollama    # after changing its environment
ollama ps                        # what is loaded, and whether it is on GPU or CPU
```

Ollama unloads an idle model after 5 minutes, so the first turn after a break pays the load cost
again. On a machine with the RAM to spare, keep it resident:

```bash
sudo systemctl edit ollama
```

```ini
[Service]
Environment="OLLAMA_KEEP_ALIVE=30m"
```

```bash
sudo systemctl restart ollama
```

`systemctl edit` writes a drop-in under `/etc/systemd/system/ollama.service.d/`, which survives
an Ollama upgrade. Editing `/etc/systemd/system/ollama.service` directly does not.

---

## GPU

The installer detects an existing GPU and configures itself; it does **not** install drivers. If
`ollama ps` reports `100% CPU` on a machine that has an NVIDIA card, the driver is what's missing:

```bash
ubuntu-drivers devices           # what Ubuntu recommends for this card
sudo ubuntu-drivers install      # install it
sudo reboot                      # required — the kernel module loads at boot
nvidia-smi                       # should list the card after the reboot
sudo systemctl restart ollama    # re-detect now that the driver is there
```

AMD cards need the ROCm build, which the same install script fetches when it detects one. Intel
and Apple GPUs are not accelerated on Linux — those run on CPU, and `llama3.2` is the honest
choice there.

A model larger than VRAM is split across GPU and CPU rather than refused, which reads as a
mysteriously slow GPU. `ollama ps` shows the split.

---

## Serving another machine

Ollama binds to `127.0.0.1` by default, so nothing off the box can reach it. To run the model on a
desktop and develop on a laptop:

```bash
sudo systemctl edit ollama
```

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

```bash
sudo systemctl restart ollama
sudo ufw allow from 192.168.1.0/24 to any port 11434 proto tcp   # your LAN, not "any"
```

Then on the laptop:

```bash
OLLAMA_BASE_URL=http://192.168.1.42:11434/v1
```

**Ollama has no authentication.** Anything that can reach port 11434 can run models, pull models
and read what is installed. Bind it to a LAN you trust, never to a public interface, and put it
behind SSH or a reverse proxy with auth if it has to cross a network you don't control.

---

## When a turn comes back on the mock

Any provider failure degrades the turn to the offline mock rather than erroring at the student, so
the symptom is always the same: an **"offline interviewer"** badge in the chat. The reason is in
the `pnpm dev` log, and the messages name the fix (`lib/llm/errors.ts`).

| Log line | What happened | Fix |
|---|---|---|
| `Ollama not reachable at … — is 'ollama serve' running?` | Nothing is listening on 11434 | `systemctl status ollama`, then `sudo systemctl enable --now ollama` |
| `Ollama has no model 'x' — run 'ollama pull x'` | `OLLAMA_MODEL` names something never pulled | `ollama pull x`, or fix the typo |
| `Ollama unavailable (5xx)` | Server up, request failed — usually out of memory | Smaller model, or check `journalctl -u ollama` |
| No Ollama lines at all, mock every turn | `LLM_PROVIDER` isn't `ollama` | It is never auto-detected. Set it, restart `pnpm dev` |

Other things that bite on a fresh Ubuntu box:

- **`bind: address already in use`** from `ollama serve` — the systemd service already has the
  port. That is success, not a conflict.
- **`ollama: command not found` right after installing** — the shell cached the old `PATH`. Open a
  new terminal.
- **First turn times out, later ones are fine** — cold model load, not a bug. `ollama run <model>`
  once to warm it, or set `OLLAMA_KEEP_ALIVE`.
- **The disk quietly fills** — models live in `/usr/share/ollama/.ollama/models`. `ollama list`,
  then `ollama rm` the ones you stopped using.

The whole path has test coverage that needs no server: `pnpm test tests/ollama.test.ts` exercises
the SSE parsing, the error classification and the fallback wiring against a stubbed `fetch`. If
those pass and a real turn doesn't, the problem is on this page, not in the code.

---

## Removing it

```bash
sudo systemctl disable --now ollama
sudo rm /etc/systemd/system/ollama.service
sudo rm -r /etc/systemd/system/ollama.service.d      # any drop-ins you added
sudo rm "$(command -v ollama)"
sudo rm -r /usr/share/ollama                          # the models — several GB
sudo userdel ollama && sudo groupdel ollama
```

Drop `LLM_PROVIDER=ollama` from `.env.local` afterwards, or every turn falls to the mock with an
unreachable-server line in the log.
