<script lang="ts">
	import { refreshSession } from "$lib/utils/session";
	import { onMount } from "svelte";

	let { children } = $props();

	let intervalId: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		refreshSession();
		const unsubscribe = () => {
			if (!intervalId) {
				refreshSession();
				intervalId = setInterval(refreshSession, 10 * 1000); // 10 minutes
			}
		};

		const handleFocus = () => {
			if (document.visibilityState === "visible") {
				refreshSession();
			}
		};
		document.addEventListener("visibilitychange", handleFocus);

		return () => {
			unsubscribe();
			document.removeEventListener("visibilitychange", handleFocus);
		};
	});
</script>

{@render children()}
