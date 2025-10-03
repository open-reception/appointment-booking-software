<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { InlineCode } from "$lib/components/ui/inline-code";
  import { Input } from "$lib/components/ui/input";
  import { TranslationWithComponent } from "$lib/components/ui/translation-with-component";
  import { Text } from "$lib/components/ui/typography";
  import type { TChannelWithFullAgents } from "$lib/types/channel";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let { entity, done }: { entity: TChannelWithFullAgents; done: () => void } = $props();

  const form = superForm(
    { id: entity.id, pause: !entity.pause },
    {
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(
            $formData.pause ? m["channels.pause.success"]() : m["channels.unpause.success"](),
          );
          done();
        } else if (event.result.type === "failure") {
          toast.error(
            $formData.pause ? m["channels.pause.error"]() : m["channels.unpause.error"](),
          );
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/pause">
  <Text style="sm" class="text-muted-foreground -mt-2 font-normal">
    <TranslationWithComponent
      translation={$formData.pause
        ? m["channels.pause.description"]({ name: "{name}" })
        : m["channels.unpause.description"]({ name: "{name}" })}
      interpolations={[
        { param: "{name}", value: getCurrentTranlslation(entity.names), snippet: inlineCode },
      ]}
    />
  </Text>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {$formData.pause ? m["channels.pause.action"]() : m["channels.unpause.action"]()}
    </Form.Button>
  </div>
</Form.Root>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
