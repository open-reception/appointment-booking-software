<script lang="js">
  let { children, variant, color } = $props();
</script>

<span class={[variant, color].join(" ")}>{@render children?.()}</span>

<svelte:head>
  <style>
    .lg {
      font-size: 16px;
      line-height: 1.5;
    }
    .md {
      font-size: 14px;
      line-height: 1.5;
    }
    .sm {
      font-size: 12px;
      line-height: 1.5;
    }
    .xs {
      font-size: 10px;
      line-height: 1.25;
    }
    .text-light {
      color: #888888;
    }
  </style>
</svelte:head>
