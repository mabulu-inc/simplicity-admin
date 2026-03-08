# ADR-004: SvelteKit + Svelte 5 for Admin UI

## Status
Accepted

## Context
The admin UI needs a frontend framework. Options considered:
1. React + Next.js: Largest ecosystem, most developers know it
2. SvelteKit + Svelte 5: Smaller bundle, better performance, simpler reactivity model
3. Web Components: Framework-agnostic, works anywhere
4. Server-rendered (HTMX/template engine): No JavaScript framework needed

## Decision
**SvelteKit 2 + Svelte 5** as the default UI framework. The admin UI is packaged as `@simplicity-admin/ui` and ships as a SvelteKit library.

Key reasons:
- **Performance**: Svelte compiles to vanilla JS — smaller bundles, faster initial load
- **Svelte 5 runes**: Fine-grained reactivity without virtual DOM overhead
- **SvelteKit**: Full-stack framework with SSR, routing, and server-side data loading
- **Developer experience**: Less boilerplate than React, more intuitive state management

The UI provider is swappable via the provider pattern. A developer who needs React can implement the `UIProvider` interface and mount their own admin frontend.

The UI communicates with the API layer via HTTP (GraphQL queries/mutations). It does NOT directly import `@simplicity-admin/db` or `@simplicity-admin/api` — this ensures the UI can be replaced without touching the backend.

Design tokens (CSS custom properties) provide theming:
- Light and dark themes ship by default
- Developers can create custom themes by overriding CSS custom properties
- Components use semantic tokens (e.g., `--color-surface`) not primitive values

## Consequences
**Positive:**
- Excellent performance (smaller bundles than React)
- Clean component model with Svelte 5 runes
- SvelteKit handles routing, SSR, and data loading
- Theming via CSS custom properties is framework-agnostic

**Negative:**
- Smaller ecosystem than React (fewer off-the-shelf components)
- Smaller hiring pool
- Developers less likely to know Svelte vs React

**Risks:**
- Svelte 5 is relatively new — ecosystem is still catching up
- SvelteKit breaking changes could require migration work
