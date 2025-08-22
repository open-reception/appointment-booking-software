<script lang="ts">
	import { goto } from "$app/navigation";
	import { m } from "$i18n/messages.js";
	import { getLocale } from "$i18n/runtime.js";
	import { Button } from "$lib/components/ui/button";
	import * as Form from "$lib/components/ui/form";
	import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
	import { Input } from "$lib/components/ui/input";
	import { Passkey } from "$lib/components/ui/passkey";
	import { ROUTES } from "$lib/const/routes";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { writable, type Writable } from "svelte/store";
	import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { formSchema, type FormSchema } from "./schema";
	import { Text } from "$lib/components/ui/typography";
	import { Label } from "$lib/components/ui/label";
	import type { PasskeyState } from "$lib/components/ui/passkey/state.svelte";
	import { email, unknown } from "zod/v4";

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
				toast.success(m["setup.create_admin_account.success"]());
				await goto(ROUTES.SETUP.CHECK_EMAIL, {
					state: { email: event.result.data?.form.data.email }
				});
			}

			onEvent({ isSubmitting: false });
		},
		onSubmit: () => {
			onEvent({ isSubmitting: true });

			if ($isUsingPasskey) {
				$passkeyLoading = "user";
				fetchChallenge().then((challenge) => {
					if (!challenge) {
						$passkeyLoading = "error";
					} else {
						generatePasskey({ ...challenge, email: $formData.email })
							.then(async (passkeyResp) => {
								console.log("passkeyResp", passkeyResp);
								if (!passkeyResp) {
									throw "Unusable passkey response";
								}

								// Returns ArrayBuffer that has to be converted to base64 string
								const publicKey = passkeyResp.response.getPublicKey();
								console.log("publicKey", publicKey);

								if (!publicKey) {
									throw "Public key not found in passkey response";
								}

								// May include device name and counter
								const authenticatorData = passkeyResp.response.getAuthenticatorData();
								console.log("authenticatorData", authenticatorData);

								try {
									const publicKeyBase64 = arrayBufferToBase64(publicKey);
									console.log("publicKeyBase64", publicKeyBase64);
								} catch (error) {
									console.log("error", error);
									throw error;
								}

								// $formData.passkey = {
								// 	id: passkeyResp.id,
								// 	publicKey,
								// 	counter: 0,
								// 	deviceName: passkeyResp.response.getClientExtensionResults().deviceName || "Unknown Device"
								// };
							})
							.catch(() => {
								$passkeyLoading = "error";
							});
					}
				});
			}
		}
	});

	const { form: formData, enhance, ...rest } = form;
	const isUsingPasskey = writable(true);
	const passkeyLoading: Writable<PasskeyState> = writable("initial");

	onMount(() => {
		if (!$formData.language) {
			$formData.language = getLocale() ?? "en";
		}
	});

	function arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = "";

		// Simple loop, no fancy operations
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}

		return window.btoa(binary);
	}

	function base64ToArrayBuffer(base64: string) {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	const fetchChallenge = async () => {
		const resp = await fetch("/api/auth/challenge", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ email: $formData.email })
		});

		try {
			const data = await resp.json();
			return {
				id: data.rpId,
				challenge: data.challenge
			};
		} catch (error) {
			return null;
		}
	};

	const generatePasskey = async ({
		id,
		challenge,
		email
	}: {
		id: string;
		challenge: string;
		email: string;
	}): Promise<{ response: AuthenticatorAttestationResponse } | null> => {
		try {
			const publicKey: PublicKeyCredentialCreationOptions = {
				challenge: base64ToArrayBuffer(challenge),
				rp: {
					id,
					name: "Open Reception"
				},
				user: {
					id: new Uint8Array(16),
					name: email,
					displayName: email
				},
				pubKeyCredParams: [
					{ alg: -7, type: "public-key" } // ES256
				]
			};
			return (await navigator.credentials.create({ publicKey })) as {
				response: AuthenticatorAttestationResponse;
			} | null;
		} catch (error) {
			throw error;
		}
	};

	$effect(() => {
		if ($isUsingPasskey) {
			formData.update((data) => ({
				...data,
				passphrase: ""
			}));
		} else {
			formData.update((data) => ({
				...data,
				passkey: undefined
			}));
		}
	});
</script>

<Form.Root {formId} {enhance}>
	<Form.Field {form} name="language" class="hidden">
		<Form.Control>
			{#snippet children({ props })}
				<input {...props} bind:value={$formData.language} type="hidden" />
			{/snippet}
		</Form.Control>
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
	<Form.Field {form} name="passphrase" hidden={$isUsingPasskey}>
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>{m["form.passphrase"]()}</Form.Label>
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
		<Form.Description>
			{m["form.passphraseRequirements"]()}
			{m["login.or"]()}
			<Button
				variant="link"
				size="sm"
				onclick={() => ($isUsingPasskey = true)}
				class="text-inherit"
			>
				{m["login.usePasskey"]()}
			</Button>.
		</Form.Description>
	</Form.Field>
	<div class:hidden={!$isUsingPasskey}>
		<Label class="mb-2">{m["form.passkey"]()}</Label>
		<Passkey.State state={$passkeyLoading} />
		<Text style="md" color="medium">
			{m["login.or"]()}
			<Button
				variant="link"
				size="sm"
				onclick={() => ($isUsingPasskey = false)}
				class="text-inherit"
			>
				{m["login.usePassphrase"]()}
			</Button>.
		</Text>
	</div>
</Form.Root>
