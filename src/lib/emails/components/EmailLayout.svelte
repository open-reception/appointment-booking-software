<script lang="js">
  import EmailText from "./EmailText.svelte";

  let { children } = $props();
</script>

<div class="page">
  <div class="container">
    <div class="paper">
      <div class="content">
        {@render children?.()}
      </div>
    </div>
    <div class="branding">
      <EmailText variant="sm" color="text-light">
        Powered by <a href="https://open-reception.org">OpenReception</a>
      </EmailText>
    </div>
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
      background-color: #f6f6f6;
      min-height: 100%;
      min-height: 100vh;
      box-sizing: border-box;
      width: 100%;
      padding: 0 16px 16px;
      padding: 0 1rem 1rem;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .content {
      padding: 24px;
      padding: 1.5rem;
    }
    .paper {
      background-color: white;
      width: 100%;
      box-shadow: 0 0 2px 2px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      border-bottom-right-radius: 6px;
      border-bottom-left-radius: 6px;
    }
    .branding {
      margin: 16px 0;
      margin: 1rem 0;
      padding: 0 16px;
      padding: 0 1rem;
      text-align: center;
    }
  </style>
</svelte:head>
