<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { CenteredCard } from "$lib/components/layouts";
  import { PageWithClaim } from "$lib/components/ui/page";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { CenterState } from "$lib/components/templates/empty-state";
  import MailPlus from "@lucide/svelte/icons/mail-plus";
  import { superForm, type Infer, type SuperValidated } from "sveltekit-superforms/client";
  import { formSchema, type FormSchema } from "./schema";
  import { toast } from "svelte-sonner";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { ROUTES } from "$lib/const/routes";
  import { Input } from "$lib/components/ui/input";

  let { data }: { data: { form: SuperValidated<Infer<FormSchema>> } } = $props();

  const formId = "resend-confirmation-email";
  let email = $state("");
  let isSubmitting = $state(false);
  const form = superForm(data.form, {
    resetForm: false,
    validators: zodClient(formSchema),
    onResult: (event) => {
      if (event.result.type === "success") {
        toast.success(m["setup.verify_email.success"]());
      }
      isSubmitting = false;
    },
    onSubmit: () => {
      isSubmitting = true;
    },
  });
  const { form: formData, enhance } = form;

  onMount(async () => {
    // @ts-expect-error should be valid
    email = page.state.email;

    // This page is only of help, if you have just created an admin account
    if (!email) {
      await goto(ROUTES.SETUP.CREATE_ADMIN_ACCOUNT);
    }

    // Set email from previous step
    // Setting it hopefully after form is hydrated from load function
    setTimeout(() => {
      $formData.email = email;
    }, 150);
  });
</script>

<svelte:head>
  <title>{m["setup.verify_email.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Main>
      <CenterState
        Icon={MailPlus}
        headline={m["setup.verify_email.title"]()}
        description={m["setup.verify_email.description"]({
          email: email,
        })}
      />
    </CenteredCard.Main>
    <CenteredCard.Action>
      <Form.Root {formId} {enhance}>
        <Form.Field {form} name="email" class="hidden">
          <Form.Control>
            {#snippet children({ props })}
              <Input {...props} bind:value={$formData.email} type="hidden" />
            {/snippet}
          </Form.Control>
        </Form.Field>
        <Form.Button
          size="lg"
          class="w-full"
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {m["setup.verify_email.action"]()}
        </Form.Button>
      </Form.Root>
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
