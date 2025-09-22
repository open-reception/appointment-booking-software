<script lang="ts">
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
    </HorizontalPagePadding>
  </main>
</PageWithClaim>
