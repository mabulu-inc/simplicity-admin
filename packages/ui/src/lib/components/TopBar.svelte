<script lang="ts">
  import NotificationBell from './notifications/NotificationBell.svelte';

  interface TopBarProps {
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
  }

  let {
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
  }: TopBarProps = $props();

  function formatRole(role: string): string {
    return role
      .replace(/^app_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function handleRoleChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    onRoleChange?.(value);
  }

  function handleTenantChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    onTenantChange?.(value === '__global__' ? null : value);
  }

  let currentTenant = $derived(
    tenants?.find((t) => t.id === currentTenantId),
  );
</script>

<header data-testid="topbar">
  <div>
    {#if tenants && tenants.length > 0}
      <div data-testid="tenant-switcher">
        {#if tenants.length === 1}
          <span>{tenants[0].name}</span>
        {:else}
          <select value={currentTenantId ?? '__global__'} onchange={handleTenantChange}>
            {#if superAdmin}
              <option value="__global__">Global Mode</option>
            {/if}
            {#each tenants as tenant}
              <option value={tenant.id}>{tenant.name}</option>
            {/each}
          </select>
        {/if}
      </div>
    {/if}
  </div>

  <div>
    <div data-testid="role-switcher">
      {#if roles.length === 1}
        <span>{formatRole(roles[0])}</span>
      {:else}
        <select value={activeRole} onchange={handleRoleChange}>
          {#each roles as role}
            <option value={role}>{formatRole(role)}</option>
          {/each}
        </select>
      {/if}
    </div>

    <NotificationBell unreadCount={unreadCount ?? 0} />

    <div data-testid="user-menu">
      <span>
        {#if user.avatarUrl}
          <img src={user.avatarUrl} alt={user.displayName} />
        {:else}
          {user.displayName.charAt(0).toUpperCase()}
        {/if}
      </span>
      <span>{user.displayName}</span>
      {#if onLogout}
        <button onclick={onLogout}>Logout</button>
      {/if}
    </div>
  </div>
</header>
