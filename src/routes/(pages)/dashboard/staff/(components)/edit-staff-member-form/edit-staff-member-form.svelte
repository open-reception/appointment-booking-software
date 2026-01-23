<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import type { TStaff } from "$lib/types/users";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import RolePermissions from "../role-permissions.svelte";
  import { roles } from "../utils";

  let { entity, done }: { entity: TStaff; done: () => void } = $props();

  const availableRoles = $derived(roles.filter((it) => it.value !== "GLOBAL_ADMIN"));

  // svelte-ignore state_referenced_locally
  const form = superForm(
    {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      role: entity.role,
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["staff.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["staff.edit.error"]());
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
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.name} type="name" />
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
  <Form.Field {form} name="role">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["staff.form.fields.role.title"]()}</Form.Label>
        <Select.Root
          type="single"
          bind:value={$formData.role}
          name={props.name}
          onValueChange={(v) => ($formData.role = v as TStaff["role"])}
        >
          <Select.Trigger {...props} class="w-full">
            {@const value = roles.find((r) => r.value === $formData.role)?.label}
            {value ? value : m["staff.form.fields.role.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each availableRoles as role (role.value)}
              <Select.Item value={role.value}>
                {role.label}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <Form.Description>
          <RolePermissions role={$formData.role} class="pt-2" />
        </Form.Description>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["staff.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
