<script>
	import { createLogger } from "$lib/logger";
	import { onMount } from "svelte";

	let envVarsOkay = {};

	const logger = createLogger("HomePage");

	onMount(async () => {
		const response = await fetch("/api/env");
		logger.info("Mounted home page");
		envVarsOkay = (await response.json()).envOkay ? "okay" : "not okay";
		logger.error("THis should also be send to the server");
	});
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<p>Environment configuration is {envVarsOkay}</p>
