<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { supportedLocales, translatedLocales } from "$lib/const/locales";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import type { TStaff } from "$lib/types/users";
  import { toast } from "svelte-sonner";
  import { get } from "svelte/store";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import RolePermissions from "../role-permissions.svelte";
  import { roles } from "../utils";

  let { done }: { done: () => void } = $props();

  const tenantLocales = get(tenants).currentTenant?.languages ?? [];
  const userRole = $derived($auth.user?.role ?? "STAFF");
  const availableRolesForUser = $derived(
    userRole === "GLOBAL_ADMIN" ? roles : roles.filter((it) => it.value !== "GLOBAL_ADMIN"),
  );
  const form = superForm(
    {
      name: "",
      email: "",
      language: tenantLocales[0] ?? "en",
      role: "STAFF" as TStaff["role"],
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["staff.add.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["staff.add.errors.unknown"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/add">
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
              : m["staff.form.fields.language.placeholder"]()}
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
          {m["staff.form.fields.language.description"]()}
        </Form.Description>
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
            {#each availableRolesForUser as role (role.value)}
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
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["staff.add.action"]()}
    </Form.Button>
  </div>
</Form.Root>
