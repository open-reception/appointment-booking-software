<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Text } from "$lib/components/ui/typography";
  import type { TTenant } from "$lib/types/tenant";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import z from "zod";
  import { formSchema } from ".";
  import { auth } from "$lib/stores/auth";
  import { CenterState } from "$lib/components/templates/empty-state";
  import StopIcon from "@lucide/svelte/icons/octagon-x";

  let { entity, done }: { entity: TTenant; done: () => void } = $props();

  const form = superForm(
    { tenantId: entity.id, shortname: "" },
    {
      validators: zodClient(
        formSchema.merge(
          z.object({
            shortname: z.string().refine((val) => val === entity.shortName, {
              message: m["form.errors.deleteConfirmation"]({
                expectedValue: entity.shortName,
              }),
            }),
          }),
        ),
      ),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["tenants.delete.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["tenants.delete.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

{#if $auth.user?.tenantId === entity.id}
  <CenterState
    headline={m["tenants.delete.unavailable.title"]()}
    description={m["tenants.delete.unavailable.description"]()}
    Icon={StopIcon}
    size="sm"
  />
{:else}
  <Form.Root {enhance} action="?/delete">
    <Text style="sm" class="text-muted-foreground -mt-2 font-normal">
      {@html m["tenants.delete.description"]({
        name: `<code class="rounded-md bg-muted px-1 py-0.5">${entity.shortName}</code>`,
      })}
    </Text>
    <Form.Field {form} name="shortname">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["form.name"]()}</Form.Label>
          <Input {...props} bind:value={$formData.shortname} type="text" autocomplete="off" />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="tenantId" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["form.name"]()}</Form.Label>
          <Input {...props} bind:value={$formData.tenantId} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>

    <div class="mt-6 flex flex-col gap-4">
      <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
        {m["tenants.delete.action"]()}
      </Form.Button>
    </div>
  </Form.Root>
{/if}
