<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Alert from "$lib/components/ui/alert";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public";
  import type { TPublicAppointment } from "$lib/types/public";
  import { Lock } from "@lucide/svelte";
  import { get } from "svelte/store";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { createFormSchema } from "./schema";

  const { proceed }: { proceed: (a: Partial<TPublicAppointment>) => void } = $props();
  const tenant = $derived($publicStore.tenant);
  const appointment = $derived($publicStore.newAppointment);

  const form = superForm(
    {
      salutation: "",
      name: "",
      shareEmail: false,
      email: "",
      phone: get(publicStore).tenant?.requirePhone ? "" : undefined,
    },
    {
      dataType: "json",
      validators: zodClient(createFormSchema(get(publicStore).tenant?.requirePhone)),
      onSubmit: async ({ cancel }) => {
        isSubmitting = true;
        if ($formData.phone === "") {
          $formData.phone = undefined;
        }
        const validation = await validateForm();
        if (validation.valid) {
          proceed({
            ...appointment,
            data: {
              salutation: validation.data.salutation,
              name: validation.data.name,
              shareEmail: validation.data.shareEmail,
              email: validation.data.email,
              phone: validation.data.phone,
              locale: navigator.language || "en",
            },
          });
          cancel();
        }
        isSubmitting = false;
      },
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance, validateForm } = form;
</script>

{#if tenant}
  <div class="flex flex-col gap-4 pb-1">
    <Text style="sm" class="font-medium">
      {m["public.steps.data.title"]()}
    </Text>
    <Alert.Root>
      <Lock />
      <Alert.Title>{m["public.steps.data.alert.title"]()}</Alert.Title>
      <Alert.Description
        >{m["public.steps.data.alert.description"]({ name: tenant.longName })}</Alert.Description
      >
    </Alert.Root>
    <Form.Root {enhance} class="flex flex-col gap-4">
      <Form.Field {form} name="salutation" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["form.salutation"]()}</Form.Label>
            <Input {...props} bind:value={$formData.salutation} type="text" />
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
      <div>
        <Form.Field {form} name="email">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>{m["form.email"]()}</Form.Label>
              <Input {...props} bind:value={$formData.email} type="email" />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="shareEmail">
          <Form.Control>
            {#snippet children({ props })}
              <CheckboxWithLabel
                {...props}
                bind:value={$formData.shareEmail}
                label={m["public.steps.data.email.notifyMe"]()}
                tooltip={m["public.steps.data.email.tooltip"]()}
                onCheckedChange={(v) => {
                  $formData.shareEmail = v;
                }}
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </div>
      <Form.Field {form} name="phone">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["form.phone"]()}</Form.Label>
            <Input {...props} bind:value={$formData.phone} type="phone" />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
        <Form.Description class="mt-1">
          {m["public.steps.data.phone.description"]({ name: tenant.longName })}
          {#if tenant?.requirePhone === false}
            {m["public.steps.data.phone.optional"]()}
          {/if}
        </Form.Description>
      </Form.Field>
      <div class="mt-6 flex flex-col gap-4">
        <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
          {m["public.steps.data.action"]()}
        </Form.Button>
      </div>
    </Form.Root>
  </div>
{/if}
