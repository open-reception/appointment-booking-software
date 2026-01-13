<script lang="js">
  let { children, variant = "h2", class: className = "" } = $props();
</script>

<svelte:element this={variant} class={[className].filter((it) => it).join(" ")}>
  {@render children?.()}
</svelte:element>
