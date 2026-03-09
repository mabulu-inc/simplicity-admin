<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import TopBar from './TopBar.svelte';
  import type { NavItem } from '$lib/nav/types.js';

  interface ShellProps {
    sidebarItems: NavItem[];
    currentPath: string;
    user: { email: string; displayName: string; avatarUrl?: string };
    roles: string[];
    activeRole: string;
    onRoleChange?: (role: string) => void;
    superAdmin?: boolean;
    tenants?: { id: string; name: string }[];
    currentTenantId?: string | null;
    onTenantChange?: (tenantId: string | null) => void;
    unreadCount?: number;
    onLogout?: () => void;
    children?: Snippet;
  }

  let {
    sidebarItems,
    currentPath,
    user,
    roles,
    activeRole,
    onRoleChange,
    superAdmin,
    tenants,
    currentTenantId,
    onTenantChange,
    unreadCount,
    onLogout,
    children,
  }: ShellProps = $props();
</script>

<div class="shell">
  <Sidebar items={sidebarItems} {currentPath} />
  <div class="main">
    <TopBar
      {user}
      {roles}
      {activeRole}
      {onRoleChange}
      {superAdmin}
      {tenants}
      {currentTenantId}
      {onTenantChange}
      {unreadCount}
      {onLogout}
    />
    <main data-testid="content" class="content">
      {#if children}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

