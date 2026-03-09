// packages/ui/src/lib/dashboards/types.ts — Dashboard and widget type definitions

export interface Dashboard {
	id: string;
	name: string;
	slug: string;
	roles: string[];
	isDefault: boolean;
	layout: WidgetLayout[];
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface WidgetLayout {
	widgetId: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Widget {
	id: string;
	type: 'stat' | 'table' | 'chart';
	title: string;
	config: StatConfig | TableConfig | ChartConfig;
}

export interface StatConfig {
	query: string;
	format?: 'number' | 'currency' | 'percent';
	prefix?: string;
	suffix?: string;
	trend?: {
		query: string;
	};
}

export interface TableConfig {
	query: string;
	columns: { key: string; label: string }[];
	limit?: number;
}

export interface ChartConfig {
	type: 'bar' | 'line' | 'pie' | 'donut';
	query: string;
	colors?: string[];
}
