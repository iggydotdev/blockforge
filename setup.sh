#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Agent Pipeline Setup Script
# Installs the agent-driven development pipeline into any project.
#
# Usage:
#   # One-liner using gh (recommended — works for private repos):
#   gh api repos/Deloitte-Australia/hench/contents/setup.sh \
#     -H "Accept: application/vnd.github.raw" | bash
#
#   # Pinned to a ref:
#   gh api 'repos/Deloitte-Australia/hench/contents/setup.sh?ref=main' \
#     -H "Accept: application/vnd.github.raw" | bash
#
#   # Locally:
#   bash setup.sh
#
# Requirements:
#   - gh (GitHub CLI), authenticated:  gh auth login
#   - SSO authorisation if the org enforces it:
#       https://github.com/settings/tokens → Configure SSO
#       (or: gh auth refresh -h github.com -s read:org)
#
# Env overrides:
#   PIPELINE_REPO=owner/repo   (default: Deloitte-Australia/hench)
#   PIPELINE_REF=main          (default: main)
#
# What it does:
#   1. Copies agent files to .github/agents/
#   1b. Installs MCP server config to .vscode/mcp.json
#   2. Creates .state/ directory with README
#   3. Creates docs/decisions/ and docs/patterns/
#   4. Updates .gitignore
#   5. Tells you to run @bootstrap
# ─────────────────────────────────────────────────────────────

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }

# ── Determine source location ──────────────────────────────

# If piped via curl, download agents from the repo
# If run locally, copy from the template directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" 2>/dev/null)" && pwd 2>/dev/null || echo "")"
TEMPLATE_DIR="${SCRIPT_DIR}/templates/agents"

# Defaults — overridable via env vars.
#   PIPELINE_REPO   owner/repo (default: Deloitte-Australia/hench)
#   PIPELINE_REF    git ref / branch / tag (default: main)
PIPELINE_REPO="${PIPELINE_REPO:-Deloitte-Australia/hench}"
PIPELINE_REF="${PIPELINE_REF:-main}"

if [[ -z "$SCRIPT_DIR" ]] || [[ ! -d "$TEMPLATE_DIR" ]]; then
  USE_REMOTE=true

  if ! command -v gh &>/dev/null; then
    echo -e "${YELLOW}[error]${NC} 'gh' (GitHub CLI) is required for remote installs."
    echo "        Install: https://cli.github.com/  (brew install gh)"
    echo "        Then:    gh auth login"
    exit 1
  fi

  if ! gh auth status &>/dev/null; then
    echo -e "${YELLOW}[error]${NC} gh is not authenticated. Run: gh auth login"
    exit 1
  fi

  # SSO sanity-check: probe the repo. Surfaces clear error before any downloads.
  if ! gh api "repos/${PIPELINE_REPO}" --silent 2>/dev/null; then
    echo -e "${YELLOW}[error]${NC} Cannot access ${PIPELINE_REPO} via gh."
    echo "        Likely causes:"
    echo "          • Token not authorised for the org's SAML SSO."
    echo "            Fix: https://github.com/settings/tokens → Configure SSO"
    echo "                 (or: gh auth refresh -h github.com -s read:org)"
    echo "          • Wrong repo. Override with PIPELINE_REPO=owner/repo"
    exit 1
  fi

  info "Running in remote mode — fetching from:"
  info "  repo: $PIPELINE_REPO  ref: $PIPELINE_REF"
  info "  Override with PIPELINE_REPO / PIPELINE_REF env vars."
else
  USE_REMOTE=false
  TEMPLATE_MCP="${SCRIPT_DIR}/templates/mcp.json"
  info "Running in local mode — copying from $TEMPLATE_DIR"
fi

# ── Helper: fetch a file from the pipeline repo via gh api ──
# Works for private repos (with auth) and follows the requested ref.
# Usage: fetch_template <repo-relative-path> <output-file>
fetch_template() {
  local path="$1" out="$2"
  if gh api "repos/${PIPELINE_REPO}/contents/${path}?ref=${PIPELINE_REF}" \
       -H "Accept: application/vnd.github.raw" \
       > "$out" 2>/dev/null; then
    return 0
  fi
  rm -f "$out"
  warn "Failed to download $path from ${PIPELINE_REPO}@${PIPELINE_REF}"
  return 1
}

# ── Check we're in a project root ───────────────────────────

if [[ ! -f "package.json" ]] && [[ ! -f "Makefile" ]] && [[ ! -f "Cargo.toml" ]] && [[ ! -f "go.mod" ]]; then
  warn "No package.json, Makefile, Cargo.toml, or go.mod found."
  warn "Are you in a project root? Continuing anyway..."
fi

# ── 1. Create .github/agents/ ──────────────────────────────

AGENTS_DIR=".github/agents"
mkdir -p "$AGENTS_DIR"

AGENT_FILES=(
  "bootstrap.agent.md"
  "plan.agent.md"
  "implement.agent.md"
  "validate.agent.md"
  "fix.agent.md"
  "publish.agent.md"
  "close.agent.md"
  "figma.agent.md"
  "atlassian.agent.md"
  "playwright.agent.md"
  "github.agent.md"
)

for file in "${AGENT_FILES[@]}"; do
  if [[ -f "$AGENTS_DIR/$file" ]]; then
    warn "Skipping $file — already exists. Delete it first to overwrite."
    continue
  fi

  if [[ "$USE_REMOTE" == true ]]; then
    fetch_template "templates/agents/$file" "$AGENTS_DIR/$file" || continue
  else
    cp "$TEMPLATE_DIR/$file" "$AGENTS_DIR/$file"
  fi
  ok "Created $AGENTS_DIR/$file"
done

# ── 1b. Install MCP server config ───────────────────────────

mkdir -p ".vscode"
MCP_TARGET=".vscode/mcp.json"
MCP_TMP=".vscode/.mcp_incoming.json"

# Get the template mcp.json
if [[ "$USE_REMOTE" == true ]]; then
  if ! fetch_template "templates/mcp.json" "$MCP_TMP"; then
    warn "Skipping MCP install — could not download templates/mcp.json"
    MCP_TMP=""
  fi
else
  cp "$TEMPLATE_MCP" "$MCP_TMP"
fi

if [[ -n "$MCP_TMP" ]]; then
  if [[ ! -f "$MCP_TARGET" ]]; then
    mv "$MCP_TMP" "$MCP_TARGET"
    ok "Created $MCP_TARGET with pipeline MCP servers"
  else
    # Merge: add missing servers without overwriting existing ones
    if command -v jq &>/dev/null; then
      # Existing servers take precedence — template fills gaps
      jq -s '.[0].servers as $existing |
             .[1].servers as $template |
             .[0] | .servers = ($template + $existing)' \
        "$MCP_TARGET" "$MCP_TMP" > "${MCP_TARGET}.merged" \
        && mv "${MCP_TARGET}.merged" "$MCP_TARGET"
      rm -f "$MCP_TMP"
      ok "Merged pipeline MCP servers into existing $MCP_TARGET"
    else
      mv "$MCP_TMP" ".vscode/mcp.pipeline.json"
      warn "$MCP_TARGET already exists and jq is not installed."
      warn "Wrote template to .vscode/mcp.pipeline.json — merge manually."
    fi
  fi
fi

# ── 2. Create .state/ directory ─────────────────────────────

mkdir -p ".state"

if [[ ! -f ".state/README.md" ]]; then
  cat > ".state/README.md" << 'STATE_README'
# .state/ — Agent Pipeline Working Memory

This directory holds short-term state files created by the agent pipeline during development. It is **gitignored** (except this README).

## Structure

```
.state/
├── README.md              ← this file (committed)
├── current/               ← active ticket context (created at runtime)
│   ├── ticket.md          ← parsed requirements + ACs (written by plan)
│   ├── design.md          ← Figma specs snapshot (written by plan)
│   ├── plan.md            ← implementation plan (written by plan)
│   ├── implementation.md  ← what was built (written by orchestrator)
│   ├── qa-results/        ← QA reports per iteration
│   │   └── run-N.md
│   └── diagnosis/         ← fix attempts per iteration
│       └── attempt-N.md
└── history/               ← archived completed tickets
    └── PROJ-456/
```

## File Format

All state files use Markdown with YAML frontmatter:

```yaml
---
ticket: PROJ-456
agent: plan
version: 1
timestamp: 2026-04-15T14:30:00Z
---
```
STATE_README
  ok "Created .state/README.md"
else
  warn "Skipping .state/README.md — already exists."
fi

# ── 3. Create long-term memory directories ──────────────────

mkdir -p "docs/decisions" "docs/patterns"

[[ ! -f "docs/decisions/.gitkeep" ]] && touch "docs/decisions/.gitkeep" && ok "Created docs/decisions/"
[[ ! -f "docs/patterns/.gitkeep" ]] && touch "docs/patterns/.gitkeep" && ok "Created docs/patterns/"

# ── 4. Update .gitignore ────────────────────────────────────

GITIGNORE_ENTRIES=(
  '# Agent pipeline state — ephemeral per-ticket working memory'
  '.state/*'
  '!.state/README.md'
  ''
  '# Throwaway test artifacts'
  'drafts/tmp/*'
  'test/tmp/*'
)

if [[ -f ".gitignore" ]]; then
  if grep -q ".state/" ".gitignore" 2>/dev/null; then
    warn ".gitignore already has .state/ entries — skipping."
  else
    echo "" >> ".gitignore"
    for entry in "${GITIGNORE_ENTRIES[@]}"; do
      echo "$entry" >> ".gitignore"
    done
    ok "Updated .gitignore with .state/ and test artifact entries"
  fi
else
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    echo "$entry" >> ".gitignore"
  done
  ok "Created .gitignore with .state/ and test artifact entries"
fi

# ── 5. Summary ──────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Agent pipeline installed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Files created:"
echo "    .github/agents/   — 9 agent files (with [[PLACEHOLDERS]])"
echo "    .vscode/mcp.json  — MCP server configuration"
echo "    .state/README.md  — State directory convention"
echo "    docs/decisions/   — Long-term decision memory"
echo "    docs/patterns/    — Long-term pattern memory"
echo ""
echo -e "  ${YELLOW}Next step:${NC}"
echo "    Open VS Code and run:  @bootstrap"
echo ""
echo "    The bootstrap agent will scan your project, detect the"
echo "    tech stack, and replace all [[PLACEHOLDERS]] in the agent"
echo "    files with project-specific values."
echo ""
echo "  After bootstrap completes, your pipeline is ready:"
echo "    @plan TICKET-123"
echo ""
