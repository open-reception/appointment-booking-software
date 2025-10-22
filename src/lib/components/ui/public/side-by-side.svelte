<script lang="ts">
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { HorizontalPagePadding } from "$lib/components/ui/page";
  import { cn } from "$lib/utils";
  import * as Card from "$lib/components/ui/card";
  import type { HTMLAttributes } from "svelte/elements";

  let { children, ...restProps }: HTMLAttributes<HTMLDivElement> & {} = $props();
</script>

<HorizontalPagePadding class="py-3 md:flex md:grow md:flex-col md:justify-center">
  <MaxPageWidth maxWidth="lg" class={cn("w-full gap-5 md:flex")} {...restProps}>
    <Card.Root class="w-full md:flex md:flex-row md:gap-5">
      {@render children?.()}
    </Card.Root>
  </MaxPageWidth>
</HorizontalPagePadding>
