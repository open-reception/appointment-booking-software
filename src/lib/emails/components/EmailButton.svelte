<script lang="js">
  let { children, href } = $props();
</script>

<div class="button-container">
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a class="button" {href}>{@render children?.()}</a>
</div>

<svelte:head>
  <style>
    .button-container {
      margin: 24px 0;
      margin: 1.5rem 0;
    }
    .button {
      font-size: 16px;
      line-height: 1.5;
      border: 1px solid #000000;
      padding: 12px 32px;
      padding: 0.75rem 2rem;
      text-decoration: none;
      display: inline-block;
      border-radius: 12px;
    }
    .button:hover {
      cursor: pointer;
      background-color: rgb(0 0 0 / 0.1);
    }
  </style>
</svelte:head>
