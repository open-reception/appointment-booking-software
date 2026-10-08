<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages.js";
  import { FormSplit } from "$lib/components/templates/form-split";
  import { Button } from "$lib/components/ui/button";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import type { TTenantSettings } from "$lib/types/tenant";
  import { ChevronRight } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from "./schema";

  let { entity }: { entity: TTenantSettings } = $props();

  const autoDeleteDaysOptions = [
    { key: 30, label: m["settings.form.fields.autoDeleteDays.options.30"]() },
    { key: 60, label: m["settings.form.fields.autoDeleteDays.options.60"]() },
    { key: 90, label: m["settings.form.fields.autoDeleteDays.options.90"]() },
    { key: 180, label: m["settings.form.fields.autoDeleteDays.options.180"]() },
    { key: 365, label: m["settings.form.fields.autoDeleteDays.options.365"]() },
  ];

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      settings: {
        autoDeleteDays: entity.settings.autoDeleteDays,
        requirePhone: entity.settings.requirePhone || false,
      },
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
    title={m["settings.advanced.compliance.title"]()}
    description={m["settings.advanced.compliance.description"]()}
    {hint}
  >
    <Form.Field {form} name="settings.autoDeleteDays">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["settings.form.fields.autoDeleteDays.title"]()}</Form.Label>
          <Select.Root
            type="single"
            value={$formData.settings.autoDeleteDays.toString()}
            name={props.name}
            onValueChange={(v) => ($formData.settings.autoDeleteDays = parseInt(v))}
          >
            <Select.Trigger {...props} class="w-full">
              {$formData.settings.autoDeleteDays
                ? autoDeleteDaysOptions.find((x) => x.key === $formData.settings.autoDeleteDays)
                    ?.label
                : m["settings.form.fields.autoDeleteDays.placeholder"]()}
            </Select.Trigger>
            <Select.Content>
              {#each autoDeleteDaysOptions as option (option.key)}
                <Select.Item value={option.key.toString()}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </FormSplit>
  <FormSplit
    title={m["settings.advanced.requirements.title"]()}
    description={m["settings.advanced.requirements.description"]()}
  >
    <Form.Field {form} name="settings.requirePhone">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["settings.form.fields.requirePhone.title"]()}</Form.Label>
          <CheckboxWithLabel
            {...props}
            bind:value={$formData.settings.requirePhone}
            label={m["settings.form.fields.requirePhone.label"]()}
            onCheckedChange={(v) => {
              $formData.settings.requirePhone = v;
            }}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
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

{#snippet hint()}
  <Button
    variant="link"
    size="xs"
    href={resolve(ROUTES.DASHBOARD.SETTINGS.LINKS)}
    class="text-normal m-0 p-0"
  >
    <ChevronRight class="size-3 p-0" />
    {m["settings.links.legal.title"]()}
  </Button>
{/snippet}
