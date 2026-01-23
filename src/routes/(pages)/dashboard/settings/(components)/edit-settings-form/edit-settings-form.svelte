<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { FormGrid, FormGridItem } from "$lib/components/templates/form-grid";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { InputCroppedImageBlob } from "$lib/components/ui/input-cropped-image-blob";
  import { LanguageTabs } from "$lib/components/ui/language-tabs";
  import * as Select from "$lib/components/ui/select";
  import { Textarea } from "$lib/components/ui/textarea";
  import { supportedLocales, translatedLocales } from "$lib/const/locales";
  import type { TTenantSettings } from "$lib/types/tenant";
  import DefaultOrgIcon from "@lucide/svelte/icons/landmark";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from "./schema";
  import { tenants } from "$lib/stores/tenants";

  let { entity }: { entity: TTenantSettings } = $props();

  const autoDeleteDaysOptions = [
    { key: 30, label: m["settings.form.fields.autoDeleteDays.options.30"]() },
    { key: 60, label: m["settings.form.fields.autoDeleteDays.options.60"]() },
    { key: 90, label: m["settings.form.fields.autoDeleteDays.options.90"]() },
    { key: 180, label: m["settings.form.fields.autoDeleteDays.options.180"]() },
    { key: 365, label: m["settings.form.fields.autoDeleteDays.options.365"]() },
  ];
  const availableLocales = supportedLocales.map((it) => ({
    key: it,
    label: translatedLocales[it as keyof typeof translatedLocales],
  }));

  // svelte-ignore state_referenced_locally
  const form = superForm(
    {
      id: entity.id,
      languages: entity.languages,
      defaultLanguage: entity.defaultLanguage,
      shortName: entity.shortName,
      longName: entity.longName,
      logo: entity.logo,
      descriptions: supportedLocales.reduce(
        (acc, locale) => {
          return { ...acc, [locale]: entity.descriptions[locale] || "" };
        },
        {} as { [key: string]: string },
      ),
      address: entity.address,
      links: entity.links,
      settings: {
        autoDeleteDays: entity.settings.autoDeleteDays,
        requirePhone: entity.settings.requirePhone || false,
      },
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          tenants.reload();
          toast.success(m["tenants.edit.success"]());
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
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <FormGrid class="grid-flow-dense">
    <FormGridItem
      title={m["settings.form.sections.general"]()}
      hideTitleOnMobile={true}
      class="row-span-3"
    >
      <Form.Field {form} name="languages">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.form.fields.languages.title"]()}</Form.Label>
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
                  : m["settings.form.fields.languages.placeholder"]()}
              </Select.Trigger>
              <Select.Content>
                {#each availableLocales as locale (locale.key)}
                  <Select.Item value={locale.key}>{locale.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <Form.Description>
              {m["settings.form.fields.languages.description"]()}
            </Form.Description>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="defaultLanguage">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.form.fields.defaultLanguage.title"]()}</Form.Label>
            <Select.Root
              type="single"
              bind:value={$formData.defaultLanguage}
              name={props.name}
              onValueChange={(v) => ($formData.defaultLanguage = v)}
            >
              <Select.Trigger {...props} class="w-full">
                {$formData.defaultLanguage
                  ? availableLocales.find((x) => x.key === $formData.defaultLanguage)?.label
                  : m["settings.form.fields.defaultLanguage.placeholder"]()}
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
              {m["settings.form.fields.defaultLanguage.description"]()}
            </Form.Description>
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
          {m["settings.form.fields.longName.description"]()}
        </Form.Description>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="logo">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["settings.form.fields.logo.title"]()}</Form.Label>
            <InputCroppedImageBlob
              {...props}
              bind:value={$formData.logo}
              FallbackIcon={DefaultOrgIcon}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <LanguageTabs languages={$formData.languages}>
        {#snippet children({ locale })}
          <Form.Field {form} name={`descriptions.${locale}`}>
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>{m["settings.form.fields.descriptions.title"]()}</Form.Label>
                <Textarea {...props} bind:value={$formData.descriptions[locale]} maxlength={200} />
              {/snippet}
            </Form.Control>
            <Form.Description
              >{m["settings.form.fields.descriptions.description"]()}</Form.Description
            >
            <Form.FieldErrors />
          </Form.Field>
        {/snippet}
      </LanguageTabs>
    </FormGridItem>
    <FormGridItem title={m["settings.form.sections.address"]()}>
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
    </FormGridItem>
    <FormGridItem title={m["settings.form.sections.links"]()}>
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
    </FormGridItem>
    <FormGridItem title={m["settings.form.sections.advanced"]()} class="xl:col-start-3">
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
    </FormGridItem>
  </FormGrid>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button
      size="lg"
      type="submit"
      isLoading={isSubmitting}
      disabled={isSubmitting}
      class="sm:ml-auto"
    >
      {m["settings.form.action"]()}
    </Form.Button>
  </div>
</Form.Root>
