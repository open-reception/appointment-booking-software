<script lang="ts">
	import { browser } from "$app/environment";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import { ModeWatcher, setMode } from "mode-watcher";
	import "../../app.css";

	$effect(() => {
		if (!browser) return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => {
			const newMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
			setMode(newMode);
		};

		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	});

	let { children } = $props();
</script>

<ModeWatcher track={false} />
<Toaster richColors />
{@render children()}
