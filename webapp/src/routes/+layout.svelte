<script lang="ts">
	import '../app.css';
</script>

<nav>
	<a href="/">Home</a>
	<a href="/client-side">Client-Side Test</a>
	<a href="/server-side">Server-Side Test</a>
	<a href="/comparison">Comparison</a>
</nav>

<main>
	<slot />
</main>

<style>
	nav {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #f5f5f5;
		border-bottom: 1px solid #ddd;
	}

	nav a {
		text-decoration: none;
		color: #333;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	nav a:hover {
		background-color: #e0e0e0;
	}

	main {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}
</style>