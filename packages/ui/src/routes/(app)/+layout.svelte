<script lang="ts">
	import type { Snippet } from 'svelte';
	import Shell from '$lib/components/Shell.svelte';
	import type { NavItem } from '$lib/nav/types.js';

	interface AppLayoutProps {
		data: {
			user: {
				userId: string;
				email?: string;
				tenantId?: string;
				roles: string[];
				activeRole: string;
				superAdmin: boolean;
			};
			navItems: NavItem[];
			currentPath: string;
		};
		children: Snippet;
	}

	let { data, children }: AppLayoutProps = $props();

	async function handleLogout() {
		await fetch('/api/auth/session', { method: 'DELETE' });
		window.location.href = '/login';
	}
</script>

<Shell
	sidebarItems={data.navItems}
	currentPath={data.currentPath}
	user={{ email: data.user.email ?? '', displayName: data.user.email ?? 'Admin' }}
	roles={data.user.roles}
	activeRole={data.user.activeRole}
	superAdmin={data.user.superAdmin}
	onLogout={handleLogout}
>
	{@render children()}
</Shell>
