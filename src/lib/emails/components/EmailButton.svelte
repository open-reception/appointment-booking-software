<script lang="js">
  let { children, href } = $props();
</script>

<div class="button-container">
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
      color: #ffffff;
      background-color: #000000;
      padding: 12px 32px;
      padding: 0.75rem 2rem;
      text-decoration: none;
      display: inline-block;
      border-radius: 12px;
    }
    .button:hover {
      background-color: #333333;
      cursor: pointer;
    }
  </style>
</svelte:head>
