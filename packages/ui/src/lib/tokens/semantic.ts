/** Semantic token mappings — map primitive values to semantic meanings for each theme */

import type { ThemeTokens } from './types.js';
import * as p from './primitives.js';

export const lightTokens: ThemeTokens = {
	colorPrimary: p.blue500,
	colorPrimaryHover: p.blue600,
	colorSurface: p.white,
	colorSurfaceRaised: p.gray50,
	colorText: p.gray900,
	colorTextMuted: p.gray500,
	colorBorder: p.gray200,
	colorError: p.red500,
	colorSuccess: p.green500,
	colorWarning: p.amber500,

	space1: p.spacing1,
	space2: p.spacing2,
	space3: p.spacing3,
	space4: p.spacing4,
	space6: p.spacing6,
	space8: p.spacing8,

	fontSans: p.fontFamilySans,
	fontMono: p.fontFamilyMono,
	textSm: p.fontSize_sm,
	textBase: p.fontSize_base,
	textLg: p.fontSize_lg,
	textXl: p.fontSize_xl,

	radiusSm: p.radius_sm,
	radiusMd: p.radius_md,
	radiusLg: p.radius_lg,

	shadowSm: p.shadow_sm,
	shadowMd: p.shadow_md,
};

export const darkTokens: ThemeTokens = {
	colorPrimary: p.blue500,
	colorPrimaryHover: p.blue600,
	colorSurface: p.gray900,
	colorSurfaceRaised: p.gray800,
	colorText: p.gray100,
	colorTextMuted: p.gray400,
	colorBorder: p.gray700,
	colorError: p.red500,
	colorSuccess: p.green500,
	colorWarning: p.amber500,

	space1: p.spacing1,
	space2: p.spacing2,
	space3: p.spacing3,
	space4: p.spacing4,
	space6: p.spacing6,
	space8: p.spacing8,

	fontSans: p.fontFamilySans,
	fontMono: p.fontFamilyMono,
	textSm: p.fontSize_sm,
	textBase: p.fontSize_base,
	textLg: p.fontSize_lg,
	textXl: p.fontSize_xl,

	radiusSm: p.radius_sm,
	radiusMd: p.radius_md,
	radiusLg: p.radius_lg,

	shadowSm: p.shadow_sm,
	shadowMd: p.shadow_md,
};
