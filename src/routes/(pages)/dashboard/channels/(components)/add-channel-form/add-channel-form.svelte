<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { Button } from "$lib/components/ui/button";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { LanguageTabs } from "$lib/components/ui/language-tabs";
  import * as Select from "$lib/components/ui/select";
  import { SlotTemplate } from "$lib/components/ui/slot-template";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { tenants } from "$lib/stores/tenants";
  import { toast } from "svelte-sonner";
  import { get } from "svelte/store";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { DEFAULT_SLOT_TEMPLATE } from "../utils";
  import { formSchema } from "./schema";

  let { done }: { done: () => void } = $props();

  const agents = get(agentsStore).agents ?? [];
  const tenantLocales = get(tenants).currentTenant?.languages ?? [];
  const form = superForm(
    {
      names: tenantLocales.reduce(
        (acc, locale) => ({ ...acc, [locale]: "" }),
        {} as { [key: string]: string },
      ),
      descriptions: tenantLocales.reduce(
        (acc, locale) => ({ ...acc, [locale]: "" }),
        {} as { [key: string]: string },
      ),
      agentIds: [] as string[],
      isPublic: true,
      requiresConfirmation: false,
      slotTemplates: [DEFAULT_SLOT_TEMPLATE],
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["channels.add.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["channels.add.errors.unknown"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;

  const onAddSlotTemplate = () => {
    $formData.slotTemplates = [...$formData.slotTemplates, DEFAULT_SLOT_TEMPLATE];
  };

  const onRemoveSlotTemplate = (index: number) => {
    $formData.slotTemplates = $formData.slotTemplates.filter((_, i) => i !== index);
  };
</script>

<Form.Root {enhance} action="?/add">
  <LanguageTabs>
    {#snippet children({ locale })}
      <Form.Field {form} name={`names.${locale}`}>
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["channels.add.fields.name.title"]()}</Form.Label>
            <Input
              {...props}
              bind:value={$formData.names[locale]}
              minlength={2}
              maxlength={50}
              autocomplete="off"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name={`descriptions.${locale}`}>
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["channels.add.fields.description.title"]()}</Form.Label>
            <Textarea {...props} bind:value={$formData.descriptions[locale]} maxlength={1000} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    {/snippet}
  </LanguageTabs>
  <Form.Field {form} name="agentIds">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["channels.add.fields.agents.title"]()}</Form.Label>
        <Form.Description>
          {m["channels.add.fields.agents.description"]()}
        </Form.Description>
        <Select.Root
          type="multiple"
          bind:value={$formData.agentIds}
          name={props.name}
          onValueChange={(v) => ($formData.agentIds = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.agentIds.length > 0
              ? $formData.agentIds.map((id) => agents.find((x) => x.id === id)?.name).join(", ")
              : m["channels.add.fields.agents.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each agents as agent (agent.id)}
              <Select.Item value={agent.id}>{agent.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="isPublic">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["channels.add.fields.isPublic.title"]()}</Form.Label>
        <CheckboxWithLabel
          {...props}
          bind:value={$formData.isPublic}
          label={m["channels.add.fields.isPublic.label"]()}
          onCheckedChange={(v) => {
            $formData.isPublic = v;
          }}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="requiresConfirmation">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["channels.add.fields.requiresConfirmation.title"]()}</Form.Label>
        <CheckboxWithLabel
          {...props}
          bind:value={$formData.requiresConfirmation}
          label={m["channels.add.fields.requiresConfirmation.label"]()}
          onCheckedChange={(v) => {
            $formData.requiresConfirmation = v;
          }}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="slotTemplates">
    <Headline style="h4" level="h3" class="mb-0">
      {m["channels.add.fields.slotTemplates.title"]()}
    </Headline>
    <Text style="sm" class="font-normal">
      {m["channels.add.fields.slotTemplates.description"]()}
    </Text>
    <div class="flex flex-col gap-2 pt-2">
      <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
      {#each $formData.slotTemplates as _, i (`template-${i}`)}
        <SlotTemplate
          index={i}
          {form}
          bind:value={$formData.slotTemplates[i]}
          onRemove={onRemoveSlotTemplate}
        />
      {/each}
      <Button variant="outline" onclick={onAddSlotTemplate}>
        {m["components.slotTemplate.add_template"]()}
      </Button>
    </div>
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["channels.add.action"]()}
    </Form.Button>
  </div>
</Form.Root>
