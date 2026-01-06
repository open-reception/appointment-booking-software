<script lang="js">
  import { m } from "$i18n/messages";
  import EmailText from "./EmailText.svelte";

  let { children } = $props();
</script>

<div class="page">
  <div class="container">
    <div class="content">
      {@render children?.()}
    </div>
    <EmailText variant="sm" color="text-light" class="branding">
      {m["emails.poweredBy"]()} <a href="https://open-reception.org">OpenReception</a>
    </EmailText>
  </div>
</div>

<svelte:head>
  <style>
    body {
      margin: 0;
      min-height: 100%;
      min-height: 100vh;
      box-sizing: border-box;
      font-family: "Inter", Arial, sans-serif;
    }
    a {
      color: inherit;
      text-decoration: underline;
    }
    h1 {
      font-size: 18px;
      line-height: 1.5;
      font-weight: 600;
    }
    h2 {
      font-size: 16px;
      line-height: 1.5;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 8px;
    }
    h3 {
      font-size: 14px;
      line-height: 1.5;
      font-weight: 500;
    }
    h2 + p {
      margin-top: 0;
    }
    .page {
      padding: 0 16px;
      padding: 0 1rem;
      min-height: 100%;
      min-height: 100vh;
      box-sizing: border-box;
      width: 100%;
      font-family: "Inter", Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .branding {
      margin: 16px 0;
      margin: 1rem 0;
      width: 100%;
    }
  </style>
</svelte:head>
