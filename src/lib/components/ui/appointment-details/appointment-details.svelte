<script lang="ts">
  import { Text } from "$lib/components/ui/typography";
  import { languageSwitchLocales } from "$lib/const/locales";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { Calendar, Languages, Mail, Phone, User, UserStar } from "@lucide/svelte";
  import type { AppointmentDetailItems } from ".";
  import CopyButton from "./copy-button.svelte";

  let {
    items,
  }: {
    items: AppointmentDetailItems;
  } = $props();
</script>

{#if items.length > 0}
  <div class="flex flex-col items-start gap-2">
    {#each items as item (item.type)}
      {#if item.value}
        <div class="flex items-center gap-2">
          {#if item.type === "agent"}
            <UserStar class="size-4 shrink-0" />
            <Text style="sm">
              {item.value}
            </Text>
          {:else if item.type === "client-name"}
            <User class="size-4 shrink-0" />
            <Text style="sm">
              {item.value}
            </Text>
            <CopyButton value={item.value} />
          {:else if item.type === "client-locale"}
            {@const locale =
              languageSwitchLocales[item.value as keyof typeof languageSwitchLocales]}
            {#if locale}
              <Languages class="size-4 shrink-0" />
              <Text style="sm">
                {locale.label}
              </Text>
            {/if}
          {:else if item.type === "client-email"}
            <Mail class="size-4 shrink-0" />
            <a href={`mailto:${item.value}`} class="-mt-0.5 underline">
              <Text style="sm">
                {item.value}
              </Text>
            </a>
            <CopyButton value={item.value} />
          {:else if item.type === "client-phone"}
            <Phone class="size-4 shrink-0" />
            <a href={`tel:${item.value}`} class="-mt-0.5 underline">
              <Text style="sm">
                {item.value}
              </Text>
            </a>
            <CopyButton value={item.value.toString()} />
          {:else if item.type === "date"}
            <Calendar class="size-4 " />
            <Text style="sm">
              {toDisplayDateTime(item.value)}
            </Text>
            <CopyButton value={item.value.toLocaleString()} />
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
