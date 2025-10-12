<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { HorizontalPagePadding, PageWithClaim } from "$lib/components/ui/page";
  import { Headline, Text } from "$lib/components/ui/typography";

  const { data } = $props();
</script>

<svelte:head>
  <title>Hello - OpenReception</title>
</svelte:head>

<PageWithClaim>
  <main>
    <HorizontalPagePadding class="flex flex-col items-start gap-4">
      <Headline level="h1" style="h3">Hello World</Headline>
      <Text style="md">
        Environment configuration is
        {#await data.streamed.isEnvOk}
          unknown
        {:then isEnvOk}
          {isEnvOk ? "OK" : "NOT OK"}
        {/await}.
      </Text>
      <Button href="/dashboard">Go to Dashboard</Button>
    </HorizontalPagePadding>
  </main>
</PageWithClaim>
