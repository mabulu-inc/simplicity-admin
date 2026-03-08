import type { ThemeTokens } from '../tokens/types.js';
import { lightTokens, darkTokens } from '../tokens/semantic.js';

export const lightTheme: ThemeTokens = lightTokens;
export const darkTheme: ThemeTokens = darkTokens;

/**
 * Converts a camelCase token key to a CSS custom property name.
 * e.g. "colorPrimary" → "--color-primary"
 */
function tokenToCssVar(key: string): string {
	return `--${key.replace(/([A-Z])/g, '-$1').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase()}`;
}

/**
 * Applies a theme by setting CSS custom properties on document.documentElement.
 */
export function applyTheme(tokens: ThemeTokens): void {
	const style = document.documentElement.style;
	for (const [key, value] of Object.entries(tokens)) {
		style.setProperty(tokenToCssVar(key), value);
	}
}

/**
 * Returns the system color scheme preference.
 */
export function getSystemPreference(): 'light' | 'dark' {
	if (
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-color-scheme: dark)').matches
	) {
		return 'dark';
	}
	return 'light';
}
