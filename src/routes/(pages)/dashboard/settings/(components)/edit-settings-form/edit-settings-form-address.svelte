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
      address: entity.address,
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
    title={m["settings.address.address.title"]()}
    description={m["settings.address.address.description"]()}
  >
    <div class="flex flex-col gap-4">
      <div class="flex justify-between gap-3">
        <Form.Field {form} name="address.street" class="flex-4/5">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>{m["settings.form.fields.street.title"]()}</Form.Label>
              <Input {...props} bind:value={$formData.address.street} type="text" />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="address.number" class="flex-1/5">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>{m["settings.form.fields.number.title"]()}</Form.Label>
              <Input {...props} bind:value={$formData.address.number} type="text" />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </div>
      <Form.Field {form} name="address.additionalAddressInfo">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.form.fields.additionalAddressInfo.title"]()}</Form.Label>
            <Input {...props} bind:value={$formData.address.additionalAddressInfo} type="text" />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <div class="flex justify-between gap-3">
        <Form.Field {form} name="address.zip" class="flex-2/5">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>{m["settings.form.fields.zip.title"]()}</Form.Label>
              <Input {...props} bind:value={$formData.address.zip} type="text" />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="address.city" class="flex-3/5">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>{m["settings.form.fields.city.title"]()}</Form.Label>
              <Input {...props} bind:value={$formData.address.city} type="text" />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </div>
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
