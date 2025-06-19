<script>
    import { onMount } from 'svelte';
    
    let envVarsOkay = {};
    
    onMount(async () => {
        const response = await fetch('/api/env');
        envVarsOkay = (await response.json()).envOkay ? "okay" : "not okay";
    });
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<p>Environment configuration is {envVarsOkay}</p>