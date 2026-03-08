#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# ralph.sh — The Ralph Loop
#
# Runs Claude Code in a stateless loop. Each iteration gets a fresh session
# that reads PROGRESS.md and TASKS.md to pick up where the last one left off.
#
# Usage:
#   ./ralph.sh              # Run with defaults (10 iterations)
#   ./ralph.sh -n 20        # Run 20 iterations
#   ./ralph.sh -n 0         # Run until all tasks are DONE (unlimited)
#   ./ralph.sh -d 5         # 5-second delay between iterations
#   ./ralph.sh --dry-run    # Print what would happen without running
# ============================================================================

MAX_ITERATIONS=10
DELAY=2
DRY_RUN=false
LOG_DIR=".ralph-logs"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    -d|--delay)      DELAY="$2"; shift 2 ;;
    --dry-run)       DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: ./ralph.sh [-n iterations] [-d delay_seconds] [--dry-run]"
      echo ""
      echo "Options:"
      echo "  -n, --iterations  Max iterations (default: 10, 0 = unlimited)"
      echo "  -d, --delay       Seconds between iterations (default: 2)"
      echo "  --dry-run         Print config and exit"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Setup ---
mkdir -p "$PROJECT_DIR/$LOG_DIR"

# --- Helpers ---
timestamp() { date '+%Y-%m-%dT%H:%M:%S'; }

all_tasks_done() {
  # Returns 0 (true) if no TODO tasks remain in TASKS.md
  if grep -q '^\- \*\*Status\*\*: TODO' "$PROJECT_DIR/docs/TASKS.md" 2>/dev/null; then
    return 1
  fi
  return 0
}

get_next_task() {
  grep 'Next eligible task:' "$PROJECT_DIR/docs/PROGRESS.md" 2>/dev/null | sed 's/.*: //'
}

# --- Pre-flight checks ---
if ! command -v claude &>/dev/null; then
  echo "Error: 'claude' CLI not found. Install Claude Code first."
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/docs/PROGRESS.md" ]]; then
  echo "Error: docs/PROGRESS.md not found. Are you in the right project?"
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/docs/TASKS.md" ]]; then
  echo "Error: docs/TASKS.md not found. Are you in the right project?"
  exit 1
fi

# --- Config summary ---
echo "=== Ralph Loop ==="
echo "  Project:    $PROJECT_DIR"
echo "  Iterations: $([ "$MAX_ITERATIONS" -eq 0 ] && echo 'unlimited' || echo "$MAX_ITERATIONS")"
echo "  Delay:      ${DELAY}s between iterations"
echo "  Logs:       $LOG_DIR/"
echo "  Next task:  $(get_next_task)"
echo "=================="

if $DRY_RUN; then
  echo "(dry run — exiting)"
  exit 0
fi

# --- The Loop ---
iteration=0
while true; do
  iteration=$((iteration + 1))

  # Check iteration limit
  if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -gt "$MAX_ITERATIONS" ]]; then
    echo ""
    echo "[$(timestamp)] Reached max iterations ($MAX_ITERATIONS). Stopping."
    break
  fi

  # Check if all tasks are done
  if all_tasks_done; then
    echo ""
    echo "[$(timestamp)] All tasks are DONE. Ralph is finished."
    break
  fi

  next_task=$(get_next_task)
  log_file="$PROJECT_DIR/$LOG_DIR/iteration-$(printf '%03d' "$iteration").log"

  echo ""
  echo "[$(timestamp)] === Iteration $iteration — Target: $next_task ==="

  # The prompt instructs Claude to follow the boot sequence in CLAUDE.md
  PROMPT="You are in Ralph Loop iteration $iteration. Follow the Ralph Loop Boot Sequence exactly as defined in CLAUDE.md. Read PROGRESS.md first, then TASKS.md, then execute the next eligible task using red/green TDD. When done, commit and update PROGRESS.md. If blocked, update PROGRESS.md and exit."

  # Run Claude Code with a fresh session (--print for non-interactive mode)
  if claude --print \
       --max-turns 50 \
       --dangerously-skip-permissions \
       "$PROMPT" \
       > "$log_file" 2>&1; then
    echo "[$(timestamp)] Iteration $iteration completed successfully."
  else
    exit_code=$?
    echo "[$(timestamp)] Iteration $iteration exited with code $exit_code. Check $log_file"

    # If Claude itself crashed (not a task failure), don't blindly retry
    if [[ $exit_code -gt 1 ]]; then
      echo "[$(timestamp)] Non-zero exit ($exit_code) — possible crash. Continuing anyway."
    fi
  fi

  # Brief delay to avoid hammering the API
  sleep "$DELAY"
done

# --- Summary ---
echo ""
echo "=== Ralph Loop Complete ==="
echo "  Iterations run: $iteration"
echo "  Final state:"
grep -A3 '## Current State' "$PROJECT_DIR/docs/PROGRESS.md" | tail -4
echo ""
echo "  Logs: $LOG_DIR/"
echo "=========================="
