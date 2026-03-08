# The Ralph Loop

## Overview

The Ralph Loop is a brute-force AI agent persistence technique popularized by developer Geoffrey Huntley. Rather than building a complex, stateful agent, it runs an AI in a simple `while` loop until the task is complete.

## Why "Ralph"?

The name is a self-deprecating joke referencing Ralph Wiggum — the agent starts each iteration with a fresh brain and zero ego about failing. It also nods to the nerve-wracking reality of letting an AI run in an infinite loop on your API bill. (In Australian slang, "to Ralph" means to vomit — Huntley joked the idea was so simple it made him want to Ralph.)

## How It Works

The Ralph Loop solves **context rot** (AI confusion from bloated conversations) by being stateless:

1. **Plan** — Write a PRD and a progress file defining requirements and tracking state.
2. **Loop** — A bash script runs the AI agent on the prompt.
3. **Reset** — After each small task, the session is killed and a fresh one starts.
4. **Hand-off** — The new session learns what happened solely by reading files on disk and git history.

## Ralph Loop vs. Traditional Agents

| Aspect | Traditional Agents | Ralph Loop |
|---|---|---|
| Memory | Long, messy chat history | Files on disk and git commits |
| Logic | "Try to stay smart" | "Keep trying until the tests pass" |
| Autonomy | Human-in-the-loop | AFK (Away From Keyboard) coding |

## Why It Works

It's brute-force software engineering. Developers use it to clone existing apps or handle massive refactors overnight — set the loop to N iterations, walk away, and return to a series of git commits where the AI incrementally fixed its own errors until the code worked.

> "Ralph is essentially a bash loop: simple, repeatable, and shockingly effective." — Dex Horthy, HumanLayer
