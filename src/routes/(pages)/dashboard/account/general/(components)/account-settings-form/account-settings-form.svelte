<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { supportedLocales, translatedLocales, type SupportedLocale } from "$lib/const/locales";
  import { auth } from "$lib/stores/auth";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let account = $derived($auth.user);
  const form = superForm(
    {
      name: untrack(() => account?.name || ""),
      language: untrack(() => account?.language as string),
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["account.general.success"]());
        } else if (event.result.type === "failure") {
          toast.error(m["account.general.error"]());
        }
        isSubmitting = false;
      },
      onUpdated: ({ form }) => {
        if (account) {
          auth.setUser({
            ...account,
            name: form.data.name,
            language: form.data.language as SupportedLocale,
          });
        }
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance, reset } = form;

  $effect(() => {
    if (account) {
      untrack(() =>
        reset({
          data: {
            name: account.name,
            language: account.language,
          },
        }),
      );
    }
  });
</script>

{#if account}
  <Form.Root {enhance} action="?/edit">
    <Form.Field {form} name="name">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["form.name"]()}</Form.Label>
          <Input {...props} bind:value={$formData.name} type="name" />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="language">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["account.general.language.title"]()}</Form.Label>
          <Select.Root
            type="single"
            bind:value={$formData.language}
            name={props.name}
            onValueChange={(v) => ($formData.language = v)}
          >
            <Select.Trigger {...props} class="w-full">
              {$formData.language
                ? translatedLocales[$formData.language as keyof typeof translatedLocales]
                : m["account.general.language.placeholder"]()}
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
            {m["account.general.language.hint"]()}
          </Form.Description>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <div class="mt-6 flex flex-col gap-4">
      <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
        {m["account.general.action"]()}
      </Form.Button>
    </div>
  </Form.Root>
{/if}
