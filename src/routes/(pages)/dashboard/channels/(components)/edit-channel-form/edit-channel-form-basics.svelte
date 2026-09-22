<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { LanguageTabs } from "$lib/components/ui/language-tabs";
  import { Textarea } from "$lib/components/ui/textarea";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import type { TChannelWithFullAgents } from "$lib/types/channel";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { get } from "svelte/store";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let { entity, done }: { entity: TChannelWithFullAgents; done: () => void } = $props();
  const tenantLocales = get(tenants).currentTenant?.languages ?? [];

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      names: tenantLocales.reduce(
        (acc, locale) => ({ ...acc, [locale]: entity.names[locale] ?? "" }),
        {} as { [key: string]: string },
      ),
      descriptions: tenantLocales.reduce(
        (acc, locale) => ({ ...acc, [locale]: entity.descriptions[locale] ?? "" }),
        {} as { [key: string]: string },
      ),
    })),
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        auth.refreshLastActive();
        if (event.result.type === "success") {
          toast.success(m["channels.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["channels.edit.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action={`${ROUTES.DASHBOARD.CHANNELS}?/edit`}>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <LanguageTabs>
    {#snippet children({ locale })}
      <Form.Field {form} name={`names.${locale}`}>
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["channels.add.fields.name.title"]()}</Form.Label>
            <Input
              {...props}
              bind:value={$formData.names[locale]}
              minlength={2}
              maxlength={50}
              autocomplete="off"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name={`descriptions.${locale}`}>
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["channels.add.fields.description.title"]()}</Form.Label>
            <Textarea {...props} bind:value={$formData.descriptions[locale]} maxlength={1000} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    {/snippet}
  </LanguageTabs>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["channels.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
