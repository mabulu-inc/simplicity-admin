<script lang="ts">
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ strategy: 'password', email, password }),
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error ?? 'Login failed';
				return;
			}

			// Set cookie via a follow-up request that sets HttpOnly cookie,
			// or redirect with token as query param for the server to set cookie.
			// For simplicity, POST to our own SvelteKit endpoint that sets the cookie.
			const tokenRes = await fetch('/api/auth/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accessToken: data.accessToken, refreshToken: data.refreshToken }),
			});

			if (tokenRes.ok) {
				window.location.href = '/';
			} else {
				error = 'Failed to establish session';
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="login-page" data-testid="login-page">
	<div class="login-card">
		<h1>Sign In</h1>
		<p>Enter your credentials to access the admin panel.</p>

		{#if error}
			<div class="error" data-testid="login-error" role="alert">{error}</div>
		{/if}

		<form onsubmit={handleSubmit} data-testid="login-form">
			<div class="field">
				<label for="email">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					data-testid="email-input"
				/>
			</div>

			<div class="field">
				<label for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
					data-testid="password-input"
				/>
			</div>

			<button type="submit" disabled={loading} data-testid="login-button">
				{loading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
	</div>
</div>
