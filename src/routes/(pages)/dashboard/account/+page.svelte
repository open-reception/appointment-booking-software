<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import * as Item from "$lib/components/ui/item/index.js";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { ChevronRight } from "@lucide/svelte/icons";
</script>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.account"](),
      href: ROUTES.DASHBOARD.ACCOUNT.MAIN,
    },
  ]}
>
  <MaxPageWidth maxWidth="md" class="flex flex-col gap-6">
    <Headline level="h1" style="h3">{m["account.overview.title"]()}</Headline>
    <Item.Group class="gap-2">
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a href={ROUTES.DASHBOARD.ACCOUNT.GENERAL} {...props}>
            <Item.Content>
              <Item.Title>
                <Text style="md">{m["account.general.title"]()}</Text>
              </Item.Title>
              <Item.Description>
                <Text style="md">{m["account.general.description"]()}</Text>
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <ChevronRight class="size-4" />
            </Item.Actions>
          </a>
        {/snippet}
      </Item.Root>
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a href={ROUTES.DASHBOARD.ACCOUNT.CHANGE_EMAIL} {...props}>
            <Item.Content>
              <Item.Title>
                <Text style="md">{m["account.change-email.title"]()}</Text>
              </Item.Title>
              <Item.Description>
                <Text style="md">{m["account.change-email.description"]()}</Text>
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <ChevronRight class="size-4" />
            </Item.Actions>
          </a>
        {/snippet}
      </Item.Root>
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a href={ROUTES.DASHBOARD.ACCOUNT.PASSKEYS} {...props}>
            <Item.Content>
              <Item.Title>
                <Text style="md">{m["account.passkeys.title"]()}</Text>
              </Item.Title>
              <Item.Description>
                <Text style="md">{m["account.passkeys.description"]()}</Text>
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <ChevronRight class="size-4" />
            </Item.Actions>
          </a>
        {/snippet}
      </Item.Root>
      {#if $auth.user?.role === "GLOBAL_ADMIN"}
        <Item.Root variant="outline">
          {#snippet child({ props })}
            <a href={ROUTES.DASHBOARD.ACCOUNT.CHANGE_PASSPHRASE} {...props}>
              <Item.Content>
                <Item.Title>
                  <Text style="md">{m["account.change-passphrase.title"]()}</Text>
                </Item.Title>
                <Item.Description>
                  <Text style="md">{m["account.change-passphrase.description"]()}</Text>
                </Item.Description>
              </Item.Content>
              <Item.Actions>
                <ChevronRight class="size-4" />
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
      {/if}
    </Item.Group>
  </MaxPageWidth>
</SidebarLayout>
