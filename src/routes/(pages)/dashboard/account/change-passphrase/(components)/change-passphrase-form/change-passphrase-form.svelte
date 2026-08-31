<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { auth } from "$lib/stores/auth";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let account = $derived($auth.user);
  const form = superForm(
    {
      passphrase: "",
      newPassphrase: "",
      repeatedPassphrase: "",
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["account.change-passphrase.success"]());
        } else if (event.result.type === "failure") {
          switch (event.result.status) {
            case 401:
              toast.error(m["account.change-passphrase.errors.passphraseIncorrect"]());
              break;
            case 403:
              toast.error(m["account.change-passphrase.errors.notAGlobalAdmin"]());
              break;
            default:
              toast.error(m["account.change-passphrase.errors.unknown"]());
              break;
          }
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

{#if account}
  <Form.Root {enhance} action="?/edit">
    <Form.Field {form} name="passphrase">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["account.change-passphrase.currentPassphrase"]()}</Form.Label>
          <Input
            {...props}
            bind:value={$formData.passphrase}
            type="password"
            minlength={30}
            maxlength={100}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="newPassphrase">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["account.change-passphrase.newPassphrase"]()}</Form.Label>
          <Input
            {...props}
            bind:value={$formData.newPassphrase}
            type="password"
            minlength={30}
            maxlength={100}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
      <Form.Description>
        {m["form.passphraseRequirements"]()}
      </Form.Description>
    </Form.Field>
    <Form.Field {form} name="repeatedPassphrase">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["account.change-passphrase.repeatedPassphrase"]()}</Form.Label>
          <Input
            {...props}
            bind:value={$formData.repeatedPassphrase}
            type="password"
            minlength={30}
            maxlength={100}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <div class="mt-6 flex flex-col gap-4">
      <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
        {m["account.change-passphrase.action"]()}
      </Form.Button>
    </div>
  </Form.Root>
{/if}
