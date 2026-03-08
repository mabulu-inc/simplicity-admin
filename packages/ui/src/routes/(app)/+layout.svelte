<script lang="ts">
	import type { Snippet } from 'svelte';
	import Shell from '$lib/components/Shell.svelte';

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
		};
		children: Snippet;
	}

	let { data, children }: AppLayoutProps = $props();

	const sidebarItems = $derived([
		{ label: 'Dashboard', href: '/', group: 'Main' },
	]);

	const currentPath = $derived(typeof window !== 'undefined' ? window.location.pathname : '/');

	async function handleLogout() {
		await fetch('/api/auth/session', { method: 'DELETE' });
		window.location.href = '/login';
	}
</script>

<Shell
	{sidebarItems}
	{currentPath}
	user={{ email: data.user.email ?? '', displayName: data.user.email ?? 'Admin' }}
	roles={data.user.roles}
	activeRole={data.user.activeRole}
	superAdmin={data.user.superAdmin}
	onLogout={handleLogout}
>
	{@render children()}
</Shell>
