import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import StatWidget from '../../src/lib/components/widgets/StatWidget.svelte';
import TableWidget from '../../src/lib/components/widgets/TableWidget.svelte';
import ChartWidget from '../../src/lib/components/widgets/ChartWidget.svelte';
import DashboardGrid from '../../src/lib/components/DashboardGrid.svelte';
import type { Widget, WidgetLayout } from '../../src/lib/dashboards/types.js';

afterEach(() => cleanup());

describe('StatWidget', () => {
	it('renders formatted number with title', () => {
		render(StatWidget, {
			props: {
				title: 'Total Contacts',
				value: 1234,
				format: 'number',
			},
		});

		expect(screen.getByText('Total Contacts')).toBeTruthy();
		expect(screen.getByText('1,234')).toBeTruthy();
	});

	it('renders currency format with prefix', () => {
		render(StatWidget, {
			props: {
				title: 'Revenue',
				value: 50000,
				format: 'currency',
				prefix: '$',
			},
		});

		expect(screen.getByText('Revenue')).toBeTruthy();
		expect(screen.getByText('$50,000')).toBeTruthy();
	});

	it('renders percent format with suffix', () => {
		render(StatWidget, {
			props: {
				title: 'Conversion',
				value: 42.5,
				format: 'percent',
				suffix: '%',
			},
		});

		expect(screen.getByText('Conversion')).toBeTruthy();
		expect(screen.getByText('42.5%')).toBeTruthy();
	});

	it('renders error state', () => {
		render(StatWidget, {
			props: {
				title: 'Broken',
				error: 'Query failed',
			},
		});

		expect(screen.getByText('Broken')).toBeTruthy();
		expect(screen.getByText('Query failed')).toBeTruthy();
	});
});

describe('TableWidget', () => {
	it('renders rows with column headers', () => {
		const columns = [
			{ key: 'name', label: 'Name' },
			{ key: 'email', label: 'Email' },
		];
		const rows = [
			{ name: 'Alice', email: 'alice@ex.com' },
			{ name: 'Bob', email: 'bob@ex.com' },
		];

		render(TableWidget, {
			props: { title: 'Contacts', columns, rows },
		});

		expect(screen.getByText('Contacts')).toBeTruthy();
		expect(screen.getByText('Name')).toBeTruthy();
		expect(screen.getByText('Email')).toBeTruthy();
		expect(screen.getByText('Alice')).toBeTruthy();
		expect(screen.getByText('bob@ex.com')).toBeTruthy();
	});

	it('renders empty state when no rows', () => {
		render(TableWidget, {
			props: {
				title: 'Empty',
				columns: [{ key: 'name', label: 'Name' }],
				rows: [],
			},
		});

		expect(screen.getByText('No data')).toBeTruthy();
	});

	it('renders error state', () => {
		render(TableWidget, {
			props: {
				title: 'Broken Table',
				columns: [],
				rows: [],
				error: 'Query failed',
			},
		});

		expect(screen.getByText('Query failed')).toBeTruthy();
	});
});

describe('ChartWidget', () => {
	it('renders chart with title and data', () => {
		const data = [
			{ label: 'Prospect', value: 10 },
			{ label: 'Qualified', value: 5 },
		];

		render(ChartWidget, {
			props: {
				title: 'Deal Stages',
				chartType: 'bar',
				data,
			},
		});

		expect(screen.getByText('Deal Stages')).toBeTruthy();
		expect(screen.getByText('Prospect')).toBeTruthy();
		expect(screen.getByText('Qualified')).toBeTruthy();
	});

	it('renders error state', () => {
		render(ChartWidget, {
			props: {
				title: 'Broken Chart',
				chartType: 'bar',
				data: [],
				error: 'Query failed',
			},
		});

		expect(screen.getByText('Query failed')).toBeTruthy();
	});
});

describe('DashboardGrid', () => {
	it('arranges widgets by layout', () => {
		const widgets: Widget[] = [
			{
				id: 'w1',
				type: 'stat',
				title: 'Total Users',
				config: { query: 'SELECT 1', format: 'number' },
			},
			{
				id: 'w2',
				type: 'stat',
				title: 'Revenue',
				config: { query: 'SELECT 2', format: 'currency', prefix: '$' },
			},
			{
				id: 'w3',
				type: 'table',
				title: 'Recent',
				config: {
					query: 'SELECT 3',
					columns: [{ key: 'name', label: 'Name' }],
				},
			},
		];

		const layout: WidgetLayout[] = [
			{ widgetId: 'w1', x: 0, y: 0, width: 4, height: 1 },
			{ widgetId: 'w2', x: 4, y: 0, width: 4, height: 1 },
			{ widgetId: 'w3', x: 0, y: 1, width: 12, height: 2 },
		];

		const widgetData: Record<string, unknown> = {
			w1: 100,
			w2: 5000,
			w3: [{ name: 'Alice' }],
		};

		render(DashboardGrid, {
			props: { widgets, layout, widgetData },
		});

		expect(screen.getByText('Total Users')).toBeTruthy();
		expect(screen.getByText('Revenue')).toBeTruthy();
		expect(screen.getByText('Recent')).toBeTruthy();
	});

	it('shows error for widget with error data', () => {
		const widgets: Widget[] = [
			{
				id: 'w1',
				type: 'stat',
				title: 'Broken',
				config: { query: 'SELECT bad', format: 'number' },
			},
		];

		const layout: WidgetLayout[] = [
			{ widgetId: 'w1', x: 0, y: 0, width: 6, height: 1 },
		];

		const widgetData: Record<string, unknown> = {};
		const widgetErrors: Record<string, string> = {
			w1: 'Query failed',
		};

		render(DashboardGrid, {
			props: { widgets, layout, widgetData, widgetErrors },
		});

		expect(screen.getByText('Broken')).toBeTruthy();
		expect(screen.getByText('Query failed')).toBeTruthy();
	});
});
