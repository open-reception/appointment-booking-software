<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import { tick } from "svelte";
	import * as Command from "$lib/components/ui/command/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button, type ButtonSize, type ButtonVariant } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	const {
		labels,
		value,
		options = [],
		onChange,
		class: className = "",
		triggerVariant = "outline",
		triggerSize = "default"
	}: {
		labels: {
			placeholder: string;
			search: string;
			notFound: string;
		};
		value: string;
		onChange: (value: string) => void;
		triggerVariant?: ButtonVariant;
		triggerSize?: ButtonSize;
		class?: string;
		options?: { label: string; value: string; keywords?: string[] }[];
	} = $props();

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);

	const selectedValue = $derived(options.find((f) => f.value === value)?.label);

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		<Button
			variant={triggerVariant}
			size={triggerSize}
			class={cn("w-[200px] justify-between", className)}
			role="combobox"
			aria-expanded={open}
		>
			{selectedValue || labels.placeholder}
			<ChevronsUpDownIcon class="opacity-50" />
		</Button>
	</Popover.Trigger>
	<Popover.Content class="w-[200px] p-0">
		<Command.Root>
			<Command.Input autofocus placeholder={labels.search} />
			<Command.List>
				<Command.Empty>{labels.notFound}</Command.Empty>
				<Command.Group>
					{#each options as option (option.value)}
						<Command.Item
							value={option.value}
							keywords={option.keywords}
							onSelect={() => {
								onChange(option.value);
								closeAndFocusTrigger();
							}}
						>
							<CheckIcon class={cn(value !== option.value && "text-transparent")} />
							{option.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
