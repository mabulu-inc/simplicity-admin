<script lang="ts">
	interface PageProps {
		data: {
			user: {
				email?: string;
				activeRole: string;
			};
		};
	}

	let { data }: PageProps = $props();
</script>

<div data-testid="admin-home">
	<h1>Welcome to Simplicity Admin</h1>
	<p>Logged in as {data.user.email ?? 'Admin'} ({data.user.activeRole})</p>
</div>
