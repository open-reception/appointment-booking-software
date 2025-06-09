<script lang="ts">
	import { OptimizedArgon2 } from '$lib/crypto/optimized-argon2';
	import { onMount } from 'svelte';

	let implementations = {
		client: '',
		server: ''
	};

	onMount(async () => {
		implementations.client = await OptimizedArgon2.getImplementationInfo();
	});
</script>

<svelte:head>
	<title>Open Reception - Crypto Testing</title>
	<meta name="description" content="Test client-side and server-side encryption performance" />
</svelte:head>

<div class="container">
	<h1>Open Reception Crypto Testing</h1>
	
	<div class="card">
		<h2>Welcome to the Crypto Webapp</h2>
		<p>
			This application demonstrates the optimized encryption functions of Open Reception
			both in the browser (Client-Side Rendering) and on the server (Server-Side Rendering).
		</p>
		
		<h3>Available Tests:</h3>
		<ul>
			<li><strong>Client-Side Test:</strong> Encryption directly in the browser with WebAssembly</li>
			<li><strong>Server-Side Test:</strong> Encryption on the server with native libraries</li>
			<li><strong>Comparison:</strong> Both variants side by side for performance comparison</li>
		</ul>

		<h3>Current Implementation:</h3>
		<div class="result">
			<strong>Client (Browser):</strong> {implementations.client}
		</div>
	</div>

	<div class="card">
		<h2>Technology Stack</h2>
		<ul>
			<li><strong>Kyber:</strong> @noble/post-quantum ML-KEM 768 (Post-Quantum Encryption)</li>
			<li><strong>Argon2:</strong> Optimized implementation (native/WASM/fallback)</li>
			<li><strong>AES:</strong> Web Crypto API / Node.js crypto</li>
			<li><strong>Shamir:</strong> secrets.js universal implementation</li>
			<li><strong>SvelteKit:</strong> Universal Web Framework</li>
		</ul>
	</div>

	<div class="card">
		<h2>Navigation</h2>
		<div class="nav-buttons">
			<a href="/client-side">
				<button>Client-Side Test</button>
			</a>
			<a href="/server-side">
				<button>Server-Side Test</button>
			</a>
			<a href="/comparison">
				<button>Performance Comparison</button>
			</a>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		text-align: left;
	}

	.nav-buttons {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.nav-buttons a {
		text-decoration: none;
	}

	ul {
		text-align: left;
		max-width: 600px;
		margin: 1rem auto;
	}

	li {
		margin: 0.5rem 0;
	}
</style>