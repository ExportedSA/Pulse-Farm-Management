#!/usr/bin/env bash
set -euo pipefail

# ---------- Defaults ----------
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="project-export-${STAMP}.zip"
DO_BUILD=true
GIT_SNAPSHOT=false
FULL=false

# Exclusions (you can loosen these via flags)
EXCLUDES=(
  "*.git*"
  "node_modules/*"
  "dist/*"
  "build/*"
  ".cache/*"
  "*.cache*"
  ".replit-storage/*"
  ".DS_Store"
  ".vscode/*"
)

usage() {
  cat << USAGE
Usage: bash export_project.sh [options]

Options:
  --name <file.zip>        Set output filename (default: ${OUT})
  --full                   Include EVERYTHING (no exclusions)
  --include-node-modules   Keep node_modules in the zip
  --include-dist           Keep dist/ and build/ in the zip
  --no-build               Skip any build/lockfile steps
  --with-git-snapshot      git add/commit a snapshot before export
  --help                   Show this help

What it does:
  • Detects project type(s) and runs smart prep:
      - Node/Vite: npm ci|install; runs "npm run build" if defined
      - Python: writes requirements-lock.txt (pip freeze) if pip present
      - PlatformIO (ESP32): detects, but skips build unless you build yourself
  • Bundles hidden files (.replit, replit.nix, vite.config.js, .env, etc.)
  • Zips workspace with safe exclusions by default
  • Falls back to .tar.gz if 'zip' isn't available

Examples:
  bash export_project.sh --name vitjes-ready.zip
  bash export_project.sh --include-dist
  bash export_project.sh --full --name full-project-${STAMP}.zip
USAGE
}

# ---------- Parse flags ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) OUT="$2"; shift 2;;
    --full) FULL=true; shift;;
    --include-node-modules)
      # remove node_modules exclusion
      EXCLUDES=("${EXCLUDES[@]/node_modules\/*}")
      shift;;
    --include-dist)
      EXCLUDES=("${EXCLUDES[@]/dist\/*}")
      EXCLUDES=("${EXCLUDES[@]/build\/*}")
      shift;;
    --no-build) DO_BUILD=false; shift;;
    --with-git-snapshot) GIT_SNAPSHOT=true; shift;;
    --help|-h) usage; exit 0;;
    *) echo "Unknown option: $1"; usage; exit 1;;
  esac
done

# ---------- Git snapshot (optional) ----------
if $GIT_SNAPSHOT; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git add -A || true
    git commit -m "Export snapshot ${STAMP}" || true
  fi
fi

# ---------- Prep: Node/Vite ----------
if $DO_BUILD && [[ -f package.json ]]; then
  echo "[node] installing dependencies…"
  if command -v npm >/dev/null 2>&1; then
    (npm ci || npm install) || true
    if grep -q '"build"[[:space:]]*:' package.json; then
      echo "[node] running build…"
      npm run build || echo "[node] build failed or not required; continuing"
    fi
  else
    echo "[node] npm not found; skipping install/build"
  fi
fi

# ---------- Prep: Python ----------
if $DO_BUILD && { [[ -f requirements.txt ]] || [[ -f pyproject.toml ]]; }; then
  if command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
    PY="$(command -v python3 || command -v python)"
    if "$PY" -m pip --version >/dev/null 2>&1; then
      echo "[python] writing requirements-lock.txt"
      "$PY" -m pip freeze > requirements-lock.txt || true
    fi
  fi
fi

# ---------- Prep: PlatformIO / ESP32 (detect only) ----------
if [[ -f platformio.ini ]]; then
  echo "[pio] Detected PlatformIO project (no build executed by default)."
  echo "      Run 'pio run' before exporting if you want compiled artifacts."
fi

# ---------- Build exclusion args ----------
ZIP_ARGS=()
if ! $FULL; then
  for ex in "${EXCLUDES[@]}"; do
    [[ -n "$ex" ]] && ZIP_ARGS+=(-x "$ex")
  done
fi

# ---------- Create archive ----------
if command -v zip >/dev/null 2>&1; then
  echo "[zip] creating ${OUT} …"
  # Ensure we include dotfiles and everything under cwd
  zip -r "${OUT}" . "${ZIP_ARGS[@]}" >/dev/null
  ls -lh "${OUT}"
  echo "[done] ${OUT} is ready."
else
  ALT="${OUT%.zip}.tar.gz"
  echo "[zip] 'zip' not found; using tar.gz fallback: ${ALT}"
  TAR_EXCLUDES=()
  if ! $FULL; then
    for ex in "${EXCLUDES[@]}"; do
      [[ -n "$ex" ]] && TAR_EXCLUDES+=(--exclude="$ex")
    done
  fi
  tar -czf "${ALT}" "${TAR_EXCLUDES[@]}" .
  ls -lh "${ALT}"
  echo "[done] ${ALT} is ready."
fi
