# simplicity-admin — Claude Code Instructions

## Project Goal

Build simplicity-admin.
Requirements are defined in `docs/PRD.md`.

## Methodology

Follow the Ralph Methodology defined in `docs/RALPH-METHODOLOGY.md`.

## Svelte 5 Conventions

This project uses Svelte 5 with runes. Follow these rules when writing or modifying Svelte components:

- Props via `$props()` are already reactive. Do NOT copy them into `$state()` — this captures only the initial value and breaks reactivity.
- Use `$derived` for values computed from props.
- If a component must own local state initialized from a prop (e.g. a form that diverges from its input), use `$effect` to handle resets when props change.
- `svelte-check` warnings are treated as errors. Zero warnings policy.
- UI component tests must include at least one re-render with changed props to verify reactivity.
