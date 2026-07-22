<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { supportedLocales, translatedLocales } from "$lib/const/locales";
  import { tenants } from "$lib/stores/tenants";
  import { derived } from "svelte/store";
  import { toast } from "svelte-sonner";
  import { get } from "svelte/store";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import { hashEmail } from "$lib/client/appointment-crypto";

  let { done }: { done: () => void } = $props();

  const tenantId = derived(tenants, ($t) => $t.currentTenant?.id ?? null);
  const tenantLocales = get(tenants).currentTenant?.languages ?? [];
  const form = superForm(
    {
      tenant: get(tenantId),
      email: "",
      hashedEmail: "",
      language: tenantLocales[0] ?? "en",
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["clients.pinReset.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["clients.pinReset.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: async ({ jsonData }) => {
        isSubmitting = true;
        jsonData({ ...$formData, hashedEmail: await hashEmail($formData.email) });
      },
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/pinReset">
  <Form.Field {form} name="tenant" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.tenant} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.email"]()}</Form.Label>
        <Input {...props} bind:value={$formData.email} type="email" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="language">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["staff.form.fields.language.title"]()}</Form.Label>
        <Select.Root
          type="single"
          bind:value={$formData.language}
          name={props.name}
          onValueChange={(v) => ($formData.language = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.language
              ? translatedLocales[$formData.language as keyof typeof translatedLocales]
              : m["clients.pinReset.fields.language.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each supportedLocales as locale (locale)}
              <Select.Item value={locale}>
                {translatedLocales[locale as keyof typeof translatedLocales]}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <Form.Description>
          {m["clients.pinReset.fields.language.description"]()}
        </Form.Description>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["clients.pinReset.action"]()}
    </Form.Button>
  </div>
</Form.Root>
