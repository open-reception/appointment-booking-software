<script lang="ts">
	import { m } from "$i18n/messages.js";
	import * as Form from "$lib/components/ui/form";
	import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
	import { Input } from "$lib/components/ui/input";
	import { toast } from "svelte-sonner";
	import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { formSchema, type FormSchema } from "./schema";

	let {
		data,
		formId,
		onEvent
	}: { formId: string; onEvent: EventReporter; data: { form: SuperValidated<Infer<FormSchema>> } } =
		$props();

	const form = superForm(data.form, {
		validators: zodClient(formSchema),
		onResult: async (event) => {
			if (event.result.type === "success") {
				toast.success(m["confirm.resend.success"]());
			}

			onEvent({ isSubmitting: false });
		},
		onSubmit: () => onEvent({ isSubmitting: true })
	});

	const { form: formData, enhance } = form;
</script>

<Form.Root {formId} {enhance}>
	<Form.Field {form} name="email">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>{m["form.email"]()}</Form.Label>
				<Input {...props} bind:value={$formData.email} type="email" />
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
</Form.Root>
