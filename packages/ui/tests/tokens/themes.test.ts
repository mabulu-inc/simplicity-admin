import { describe, it, expect, beforeEach } from 'vitest';
import { lightTheme, darkTheme, applyTheme, getSystemPreference } from '../../src/lib/themes/index.js';
import type { ThemeTokens } from '../../src/lib/tokens/types.js';

const REQUIRED_TOKEN_KEYS: (keyof ThemeTokens)[] = [
	// Colors
	'colorPrimary',
	'colorPrimaryHover',
	'colorSurface',
	'colorSurfaceRaised',
	'colorText',
	'colorTextMuted',
	'colorBorder',
	'colorError',
	'colorSuccess',
	'colorWarning',
	// Spacing
	'space1',
	'space2',
	'space3',
	'space4',
	'space6',
	'space8',
	// Typography
	'fontSans',
	'fontMono',
	'textSm',
	'textBase',
	'textLg',
	'textXl',
	// Border radius
	'radiusSm',
	'radiusMd',
	'radiusLg',
	// Shadows
	'shadowSm',
	'shadowMd',
];

describe('ThemeTokens', () => {
	describe('lightTheme', () => {
		it('defines all required tokens', () => {
			for (const key of REQUIRED_TOKEN_KEYS) {
				expect(lightTheme[key], `lightTheme.${key} should be defined`).toBeDefined();
				expect(typeof lightTheme[key]).toBe('string');
				expect(lightTheme[key].length).toBeGreaterThan(0);
			}
		});

		it('has no extra tokens beyond ThemeTokens', () => {
			const keys = Object.keys(lightTheme);
			for (const key of keys) {
				expect(REQUIRED_TOKEN_KEYS).toContain(key);
			}
		});
	});

	describe('darkTheme', () => {
		it('defines all required tokens', () => {
			for (const key of REQUIRED_TOKEN_KEYS) {
				expect(darkTheme[key], `darkTheme.${key} should be defined`).toBeDefined();
				expect(typeof darkTheme[key]).toBe('string');
				expect(darkTheme[key].length).toBeGreaterThan(0);
			}
		});

		it('has no extra tokens beyond ThemeTokens', () => {
			const keys = Object.keys(darkTheme);
			for (const key of keys) {
				expect(REQUIRED_TOKEN_KEYS).toContain(key);
			}
		});

		it('differs from light theme in color tokens', () => {
			expect(darkTheme.colorSurface).not.toBe(lightTheme.colorSurface);
			expect(darkTheme.colorText).not.toBe(lightTheme.colorText);
		});
	});

	describe('applyTheme()', () => {
		beforeEach(() => {
			// Reset any previously set custom properties
			for (const key of REQUIRED_TOKEN_KEYS) {
				const cssVar = `--${key.replace(/([A-Z])/g, '-$1').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase()}`;
				document.documentElement.style.removeProperty(cssVar);
			}
		});

		it('sets CSS custom properties on document.documentElement', () => {
			applyTheme(lightTheme);

			const style = document.documentElement.style;
			expect(style.getPropertyValue('--color-primary')).toBe(lightTheme.colorPrimary);
			expect(style.getPropertyValue('--color-surface')).toBe(lightTheme.colorSurface);
			expect(style.getPropertyValue('--color-text')).toBe(lightTheme.colorText);
			expect(style.getPropertyValue('--space-1')).toBe(lightTheme.space1);
			expect(style.getPropertyValue('--font-sans')).toBe(lightTheme.fontSans);
			expect(style.getPropertyValue('--radius-sm')).toBe(lightTheme.radiusSm);
			expect(style.getPropertyValue('--shadow-sm')).toBe(lightTheme.shadowSm);
		});

		it('applies all tokens as CSS custom properties', () => {
			applyTheme(darkTheme);

			const style = document.documentElement.style;
			for (const key of REQUIRED_TOKEN_KEYS) {
				const cssVar = `--${key.replace(/([A-Z])/g, '-$1').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase()}`;
				expect(style.getPropertyValue(cssVar), `CSS var ${cssVar} should be set`).toBe(
					darkTheme[key],
				);
			}
		});

		it('overwrites previously applied theme', () => {
			applyTheme(lightTheme);
			expect(document.documentElement.style.getPropertyValue('--color-surface')).toBe(
				lightTheme.colorSurface,
			);

			applyTheme(darkTheme);
			expect(document.documentElement.style.getPropertyValue('--color-surface')).toBe(
				darkTheme.colorSurface,
			);
		});
	});

	describe('getSystemPreference()', () => {
		it('returns "light" or "dark"', () => {
			const result = getSystemPreference();
			expect(['light', 'dark']).toContain(result);
		});
	});
});
