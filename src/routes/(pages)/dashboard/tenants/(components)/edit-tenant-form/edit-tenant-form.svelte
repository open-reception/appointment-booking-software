<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import type { TTenant } from "$lib/types/tenant";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import * as Select from "$lib/components/ui/select";
  import { TENANT_FEATURE_FLAGS } from "$lib/const/tenants";
  import { page } from "$app/state";

  let { entity, done }: { entity: TTenant; done: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = superForm(
    { id: entity.id, domain: entity.domain, features: entity.features ?? ([] as string[]) },
    {
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["tenants.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["tenants.edit.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/edit">
  <Form.Field {form} name="domain">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.domain"]()}</Form.Label>
        <Input {...props} bind:value={$formData.domain} type="text" autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.Description>
      {m["tenants.add.domain.description"]({
        domain:
          $formData.domain.length < 2 ? "" : `${$formData.domain}.${window.location.hostname}`,
      })}
    </Form.Description>
    <Form.FieldErrors />
  </Form.Field>
  {#if page.data.streamed.hasFeatureFlags}
    <Form.Field {form} name="features">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["tenants.add.features.title"]()}</Form.Label>
          <Select.Root
            type="multiple"
            bind:value={$formData.features}
            name={props.name}
            onValueChange={(v) => ($formData.features = v)}
          >
            <Select.Trigger {...props} class="w-full">
              {$formData.features.length > 0
                ? $formData.features
                    .map((id) => TENANT_FEATURE_FLAGS.find((x) => x === id))
                    .join(", ")
                : m["tenants.add.features.placeholder"]()}
            </Select.Trigger>
            <Select.Content>
              {#each TENANT_FEATURE_FLAGS as feature (feature)}
                <Select.Item value={feature}>{feature}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  {/if}
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["tenants.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
