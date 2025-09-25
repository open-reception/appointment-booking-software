<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "svelte-sonner";
  import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import ItemIcon from "@lucide/svelte/icons/user-star";
  import { formSchema, type FormSchema } from ".";
  import { Textarea } from "$lib/components/ui/textarea";
  import { InputCroppedImageBlob } from "$lib/components/ui/input-cropped-image-blob";

  let { data, done }: { done: () => void; data: { form: SuperValidated<Infer<FormSchema>> } } =
    $props();

  const form = superForm(data.form, {
    validators: zodClient(formSchema),
    onResult: async (event) => {
      if (event.result.type === "success") {
        toast.success(m["agents.add.success"]());
        done();
      } else if (event.result.type === "failure") {
        toast.error(m["agents.add.errors.unknown"]());
      }
      isSubmitting = false;
    },
    onSubmit: () => (isSubmitting = true),
  });

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
  <Form.Field {form} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["agents.add.fields.description.title"]()}</Form.Label>
        <Textarea {...props} bind:value={$formData.description} maxlength={200} />
      {/snippet}
    </Form.Control>
    <Form.Description>{m["agents.add.fields.description.description"]()}</Form.Description>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="image">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["agents.add.fields.image.title"]()}</Form.Label>
        <InputCroppedImageBlob {...props} FallbackIcon={ItemIcon} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["agents.add.action"]()}
    </Form.Button>
  </div>
</Form.Root>
