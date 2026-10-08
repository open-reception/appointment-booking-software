<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { FormSplit } from "$lib/components/templates/form-split";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import type { TTenantSettings } from "$lib/types/tenant";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from "./schema";

  let { entity }: { entity: TTenantSettings } = $props();

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      links: entity.links,
    })),
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        auth.refreshLastActive();
        if (event.result.type === "success") {
          tenants.reload();
          toast.success(m["settings.success"]());
        } else if (event.result.type === "failure") {
          toast.error(m["settings.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root
  {enhance}
  action={`${ROUTES.DASHBOARD.SETTINGS.MAIN}?/edit`}
  class="flex flex-col gap-10"
>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <FormSplit
    title={m["settings.links.website.title"]()}
    description={m["settings.links.website.description"]()}
  >
    <Form.Field {form} name="links.website" class="flex-3/5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["settings.form.fields.website.title"]()}</Form.Label>
          <Input {...props} bind:value={$formData.links.website} type="text" />
        {/snippet}
      </Form.Control>
      <Form.Description>
        {m["settings.form.fields.website.description"]()}
      </Form.Description>
      <Form.FieldErrors />
    </Form.Field>
  </FormSplit>
  <FormSplit
    title={m["settings.links.legal.title"]()}
    description={m["settings.links.legal.description"]()}
  >
    <div class="flex flex-col gap-4">
      <Form.Field {form} name="links.imprint" class="flex-3/5">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.form.fields.imprint.title"]()}</Form.Label>
            <Input {...props} bind:value={$formData.links.imprint} type="text" />
          {/snippet}
        </Form.Control>
        <Form.Description>
          {m["settings.form.fields.imprint.description"]()}
        </Form.Description>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="links.privacyStatement" class="flex-3/5">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.form.fields.privacyStatement.title"]()}</Form.Label>
            <Input {...props} bind:value={$formData.links.privacyStatement} type="text" />
          {/snippet}
        </Form.Control>
        <Form.Description>
          {m["settings.form.fields.privacyStatement.description"]()}
        </Form.Description>
        <Form.FieldErrors />
      </Form.Field>
    </div>
  </FormSplit>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button
      size="lg"
      type="submit"
      isLoading={isSubmitting}
      disabled={isSubmitting}
      class="sm:ml-auto"
    >
      {m["save"]()}
    </Form.Button>
  </div>
</Form.Root>
