<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { languageSwitchLocales } from "$lib/const/locales";
  import { tenants } from "$lib/stores/tenants";
  import { getDefaultAppointmentLocale } from "$lib/utils/localizations";
  import { get } from "svelte/store";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import type { TAddAppointment } from "../types";

  let {
    newAppointment,
    proceed,
  }: {
    newAppointment: TAddAppointment;
    proceed: (data: TAddAppointment) => void;
  } = $props();

  let languages = $derived($tenants.currentTenant?.languages);
  const form = superForm(
    {
      locale: getDefaultAppointmentLocale(get(tenants).currentTenant),
      name: "",
      phone: "" as string | undefined,
      shareEmail: false,
    },
    {
      validators: zodClient(formSchema),
      onSubmit: async ({ cancel }) => {
        if ($formData.phone === "") {
          $formData.phone = undefined;
        }

        const validation = await validateForm();
        if (validation.valid) {
          cancel();
          proceed({
            ...newAppointment,
            locale: $formData.locale,
            name: $formData.name,
            phone: $formData.phone,
            shareEmail: $formData.shareEmail,
          });
        }
      },
    },
  );

  const { form: formData, enhance, validateForm } = form;
</script>

<Form.Root {enhance} class="w-full">
  <Form.Field {form} name="locale">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.locale"]()}</Form.Label>
        <Select.Root type="single" {...props} bind:value={$formData.locale}>
          <Select.Trigger class="w-full">
            {@const locale = $formData.locale
              ? languageSwitchLocales[$formData.locale as keyof typeof languageSwitchLocales]
              : undefined}
            {locale ? locale.label : m["form.localePlaceholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each languages as language (language)}
              <Select.Item value={language}>
                {languageSwitchLocales[language as keyof typeof languageSwitchLocales].label}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.name} type="name" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="phone">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.phone"]()}</Form.Label>
        <Input {...props} bind:value={$formData.phone} type="phone" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description class="mt-1">
      {m["calendar.addAppointment.steps.clientData.phoneHint"]()}
    </Form.Description>
  </Form.Field>
  {#if newAppointment.email}
    <Form.Field {form} name="shareEmail">
      <Form.Control>
        {#snippet children({ props })}
          <CheckboxWithLabel
            {...props}
            bind:value={$formData.shareEmail}
            label={m["calendar.addAppointment.steps.clientData.shareEmail"]()}
            onCheckedChange={(v) => {
              $formData.shareEmail = v;
            }}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  {/if}
  <div class="mt-0 flex flex-col gap-4">
    <Form.Button size="lg" type="submit">
      {m["calendar.addAppointment.steps.clientData.action"]()}
    </Form.Button>
  </div>
</Form.Root>
