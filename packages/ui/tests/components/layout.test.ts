import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';

import Shell from '../../src/lib/components/Shell.svelte';
import Sidebar from '../../src/lib/components/Sidebar.svelte';
import TopBar from '../../src/lib/components/TopBar.svelte';

afterEach(() => cleanup());

describe('Shell', () => {
  it('renders sidebar and content area', () => {
    const { container } = render(Shell, {
      props: {
        sidebarItems: [{ label: 'Contacts', href: '/admin/contacts' }],
        currentPath: '/admin/contacts',
        user: { email: 'alice@ex.com', displayName: 'Alice' },
        roles: ['app_admin'],
        activeRole: 'app_admin',
      },
    });
    // Shell should contain a sidebar region and a main content area
    expect(container.querySelector('[data-testid="sidebar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="content"]')).toBeTruthy();
  });
});

describe('Sidebar', () => {
  const items = [
    { label: 'Contacts', href: '/admin/contacts' },
    { label: 'Deals', href: '/admin/deals' },
  ];

  it('renders navigation items', () => {
    render(Sidebar, { props: { items, currentPath: '/' } });
    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.getByText('Deals')).toBeTruthy();
    const contactLink = screen.getByText('Contacts').closest('a');
    expect(contactLink?.getAttribute('href')).toBe('/admin/contacts');
    const dealLink = screen.getByText('Deals').closest('a');
    expect(dealLink?.getAttribute('href')).toBe('/admin/deals');
  });

  it('highlights active item', () => {
    render(Sidebar, { props: { items, currentPath: '/admin/contacts' } });
    const contactLink = screen.getByText('Contacts').closest('a');
    expect(contactLink?.classList.contains('active')).toBe(true);
    const dealLink = screen.getByText('Deals').closest('a');
    expect(dealLink?.classList.contains('active')).toBe(false);
  });

  it('groups items under section headers', () => {
    const groupedItems = [
      { label: 'Contacts', href: '/admin/contacts', group: 'CRM' },
      { label: 'Deals', href: '/admin/deals', group: 'CRM' },
      { label: 'Users', href: '/admin/users', group: 'Settings' },
    ];
    render(Sidebar, { props: { items: groupedItems, currentPath: '/' } });
    expect(screen.getByText('CRM')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });
});

describe('TopBar', () => {
  const baseProps = {
    user: { email: 'alice@ex.com', displayName: 'Alice' },
    roles: ['app_admin'],
    activeRole: 'app_admin',
  };

  it('renders user info', () => {
    render(TopBar, { props: baseProps });
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('shows tenant switcher when multiple tenants provided', () => {
    render(TopBar, {
      props: {
        ...baseProps,
        tenants: [
          { id: '1', name: 'Acme' },
          { id: '2', name: 'Globex' },
        ],
        currentTenantId: '1',
      },
    });
    expect(screen.getByText('Acme')).toBeTruthy();
  });

  it('hides tenant switcher when tenants omitted', () => {
    const { container } = render(TopBar, { props: baseProps });
    expect(container.querySelector('[data-testid="tenant-switcher"]')).toBeNull();
  });

  it('shows single tenant as label without dropdown', () => {
    const { container } = render(TopBar, {
      props: {
        ...baseProps,
        tenants: [{ id: '1', name: 'Acme' }],
        currentTenantId: '1',
      },
    });
    expect(screen.getByText('Acme')).toBeTruthy();
    // Should not have a select/dropdown for single tenant
    const tenantSwitcher = container.querySelector('[data-testid="tenant-switcher"]');
    expect(tenantSwitcher?.querySelector('select')).toBeNull();
  });

  it('shows role switcher when multiple roles', () => {
    render(TopBar, {
      props: {
        ...baseProps,
        roles: ['app_admin', 'app_editor', 'app_viewer'],
        activeRole: 'app_admin',
      },
    });
    // Should show a role select with the active role
    const roleSelect = screen.getByDisplayValue('Admin');
    expect(roleSelect).toBeTruthy();
  });

  it('hides role dropdown when single role', () => {
    const { container } = render(TopBar, {
      props: {
        ...baseProps,
        roles: ['app_viewer'],
        activeRole: 'app_viewer',
      },
    });
    // Should show role label but no select
    expect(screen.getByText('Viewer')).toBeTruthy();
    const roleSwitcher = container.querySelector('[data-testid="role-switcher"]');
    expect(roleSwitcher?.querySelector('select')).toBeNull();
  });
});
