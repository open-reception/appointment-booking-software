<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { FormSplit } from "$lib/components/templates/form-split";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { InputCroppedImageBlob } from "$lib/components/ui/input-cropped-image-blob";
  import { LanguageTabs } from "$lib/components/ui/language-tabs";
  import * as Select from "$lib/components/ui/select";
  import { Textarea } from "$lib/components/ui/textarea";
  import { supportedLocales, translatedLocales } from "$lib/const/locales";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import type { TTenantSettings } from "$lib/types/tenant";
  import DefaultOrgIcon from "@lucide/svelte/icons/landmark";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from "./schema";
  import { untrack } from "svelte";

  let { entity }: { entity: TTenantSettings } = $props();

  const availableLocales = supportedLocales.map((it) => ({
    key: it,
    label: translatedLocales[it as keyof typeof translatedLocales],
  }));

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      languages: entity.languages,
      defaultLanguage: entity.defaultLanguage,
      longName: entity.longName,
      logo: entity.logo,
      descriptions: supportedLocales.reduce(
        (acc, locale) => {
          return { ...acc, [locale]: entity.descriptions[locale] || "" };
        },
        {} as { [key: string]: string },
      ),
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
    title={m["settings.general.languages.title"]()}
    description={m["settings.general.languages.description"]()}
  >
    <div class="flex flex-col gap-4">
      <Form.Field {form} name="languages">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.general.languages.languages.title"]()}</Form.Label>
            <Select.Root
              type="multiple"
              bind:value={$formData.languages}
              name={props.name}
              onValueChange={(v) => ($formData.languages = v)}
            >
              <Select.Trigger {...props} class="w-full">
                {$formData.languages.length > 0
                  ? $formData.languages
                      .map((id) => availableLocales.find((x) => x.key === id)?.label)
                      .join(", ")
                  : m["settings.general.languages.languages.placeholder"]()}
              </Select.Trigger>
              <Select.Content>
                {#each availableLocales as locale (locale.key)}
                  <Select.Item value={locale.key}>{locale.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <Form.Description>
              {m["settings.general.languages.languages.description"]()}
            </Form.Description>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="defaultLanguage">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.general.languages.defaultLanguage.title"]()}</Form.Label>
            <Select.Root
              type="single"
              bind:value={$formData.defaultLanguage}
              name={props.name}
              onValueChange={(v) => ($formData.defaultLanguage = v)}
            >
              <Select.Trigger {...props} class="w-full">
                {$formData.defaultLanguage
                  ? availableLocales.find((x) => x.key === $formData.defaultLanguage)?.label
                  : m["settings.general.languages.defaultLanguage.placeholder"]()}
              </Select.Trigger>
              <Select.Content>
                {#each $formData.languages as language (language)}
                  <Select.Item value={language}>
                    {availableLocales.find((x) => x.key === language)?.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <Form.Description>
              {m["settings.general.languages.defaultLanguage.description"]()}
            </Form.Description>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
  </FormSplit>
  <FormSplit
    title={m["settings.general.branding.title"]()}
    description={m["settings.general.branding.description"]()}
  >
    <div class="flex flex-col gap-4">
      <Form.Field {form} name="logo">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.general.branding.logo.title"]()}</Form.Label>
            <InputCroppedImageBlob
              {...props}
              bind:value={$formData.logo}
              FallbackIcon={DefaultOrgIcon}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="longName">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["form.name"]()}</Form.Label>
            <Input {...props} bind:value={$formData.longName} type="text" autocomplete="off" />
          {/snippet}
        </Form.Control>
        <Form.Description>
          {m["settings.general.branding.longName.description"]()}
        </Form.Description>
        <Form.FieldErrors />
      </Form.Field>
      <LanguageTabs languages={$formData.languages}>
        {#snippet children({ locale })}
          <Form.Field {form} name={`descriptions.${locale}`}>
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>{m["settings.general.branding.descriptions.title"]()}</Form.Label>
                <Textarea {...props} bind:value={$formData.descriptions[locale]} maxlength={200} />
              {/snippet}
            </Form.Control>
            <Form.Description
              >{m["settings.general.branding.descriptions.description"]()}</Form.Description
            >
            <Form.FieldErrors />
          </Form.Field>
        {/snippet}
      </LanguageTabs>
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
