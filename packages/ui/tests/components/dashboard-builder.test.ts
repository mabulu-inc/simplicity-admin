import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';

import DashboardBuilder from '../../src/lib/components/DashboardBuilder.svelte';

afterEach(() => cleanup());

describe('DashboardBuilder', () => {
  it('renders with initial prop values', () => {
    render(DashboardBuilder, {
      props: {
        name: 'Sales Dashboard',
        slug: 'sales-dashboard',
        isDefault: true,
        roles: ['app_admin'],
      },
    });
    expect(
      (screen.getByTestId('dashboard-name-input') as HTMLInputElement).value,
    ).toBe('Sales Dashboard');
    expect(
      (screen.getByTestId('dashboard-slug-input') as HTMLInputElement).value,
    ).toBe('sales-dashboard');
  });

  it('updates name when name prop changes', async () => {
    const { rerender } = render(DashboardBuilder, {
      props: { name: 'Sales Dashboard', slug: 'sales-dashboard' },
    });
    expect(
      (screen.getByTestId('dashboard-name-input') as HTMLInputElement).value,
    ).toBe('Sales Dashboard');

    await rerender({ name: 'Marketing Dashboard', slug: 'marketing-dashboard' });
    expect(
      (screen.getByTestId('dashboard-name-input') as HTMLInputElement).value,
    ).toBe('Marketing Dashboard');
  });

  it('updates slug when slug prop changes', async () => {
    const { rerender } = render(DashboardBuilder, {
      props: { name: 'Test', slug: 'test-1' },
    });
    expect(
      (screen.getByTestId('dashboard-slug-input') as HTMLInputElement).value,
    ).toBe('test-1');

    await rerender({ name: 'Test', slug: 'test-2' });
    expect(
      (screen.getByTestId('dashboard-slug-input') as HTMLInputElement).value,
    ).toBe('test-2');
  });

  it('updates isDefault when prop changes', async () => {
    const { rerender } = render(DashboardBuilder, {
      props: { isDefault: false },
    });
    const checkbox = screen.getByRole('checkbox', { name: /set as default/i });
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    await rerender({ isDefault: true });
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it('updates roles when prop changes', async () => {
    const { rerender } = render(DashboardBuilder, {
      props: { roles: ['app_admin'] },
    });
    const adminCheckbox = screen.getByRole('checkbox', { name: 'app_admin' });
    const editorCheckbox = screen.getByRole('checkbox', { name: 'app_editor' });
    expect((adminCheckbox as HTMLInputElement).checked).toBe(true);
    expect((editorCheckbox as HTMLInputElement).checked).toBe(false);

    await rerender({ roles: ['app_editor'] });
    expect((adminCheckbox as HTMLInputElement).checked).toBe(false);
    expect((editorCheckbox as HTMLInputElement).checked).toBe(true);
  });
});
