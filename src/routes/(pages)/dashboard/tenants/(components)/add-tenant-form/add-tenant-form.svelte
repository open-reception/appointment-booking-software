<script lang="ts">
  import { m } from "$i18n/messages.js";
  import CheckboxWithLabel from "$lib/components/ui/checkbox-with-label/checkbox-with-label.svelte";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "svelte-sonner";
  import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { formSchema, type FormSchema } from ".";

  let { data, done }: { done: () => void; data: { form: SuperValidated<Infer<FormSchema>> } } =
    $props();

  const form = superForm(data.form, {
    validators: zodClient(formSchema),
    onResult: async (event) => {
      if (event.result.type === "success") {
        toast.success(m["tenants.add.success"]());
        done();
      } else if (event.result.type === "failure") {
        switch (event.result.data?.error) {
          // TODO: Use constants for these strings shared with backend
          case "Tenant Admin E-Mail Address already exists":
            toast.error(m["tenants.add.errors.nameTaken"]());
            break;
          // TODO: Use constants for these strings shared with backend
          case "Tenant Shortname already exists":
            toast.error(m["tenants.add.errors.nameTaken"]());
            break;
          default:
            toast.error(m["tenants.add.errors.unkonwn"]());
        }
      }
      isSubmitting = false;
    },
    onSubmit: () => (isSubmitting = true),
  });

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/add">
  <Form.Field {form} name="shortname">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.shortname} type="text" autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.Description>
      {m["tenants.add.name.description"]({
        domain:
          $formData.shortname.length < 2
            ? ""
            : `${$formData.shortname}.${window.location.hostname}`,
      })}
    </Form.Description>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="inviteAdmin">
    <Form.Control>
      {#snippet children({ props })}
        <CheckboxWithLabel
          {...props}
          bind:value={$formData.inviteAdmin}
          label={m["tenants.add.invite.title"]()}
          onCheckedChange={(v) => {
            $formData.inviteAdmin = v;
            if (!v) {
              $formData.email = "";
            }
          }}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  {#if $formData.inviteAdmin === true}
    <Form.Field {form} name="email">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["form.email"]()}</Form.Label>
          <Input {...props} bind:value={$formData.email} type="email" autocomplete="email" />
        {/snippet}
      </Form.Control>
      <Form.Description>
        {m["tenants.add.email.description"]()}
      </Form.Description>
      <Form.FieldErrors />
    </Form.Field>
  {/if}
  <div class="mt-6 flex flex-col gap-4">
    <!-- <Text style="sm" class="text-muted-foreground px-5 text-center font-normal">
      {m["seeDocsForHelp"]()}
    </Text> -->
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["tenants.add.action"]()}
    </Form.Button>
  </div>
</Form.Root>
