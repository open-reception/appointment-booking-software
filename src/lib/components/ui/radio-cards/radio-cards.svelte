<script lang="ts">
  import { Label } from "$lib/components/ui/label/index.js";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
  import { Text } from "../typography";
  import { cn } from "$lib/utils";
  import type { Component } from "svelte";

  type Props = RadioGroupPrimitive.RootProps & {
    id: string;
    value?: string;
    options: { icon?: Component; value: string; title: string; description: string }[];
    onValueChange?: (value: string) => void;
  };

  let { id, value = $bindable(), options, onValueChange, ...restProps }: Props = $props();
</script>

<RadioGroup.Root {id} bind:value {...restProps} class="grid grid-cols-2 gap-2" {onValueChange}>
  {#each options as option (option.value)}
    <div>
      <RadioGroup.Item value={option.value} id={option.value} class="hidden" />
      <Label
        for={option.value}
        class={cn(
          "hover:bg-accent hover:text-accent-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus:ring-ring flex h-full cursor-pointer flex-col items-center gap-3 rounded-lg border p-3 text-center focus:ring-3 focus:ring-offset-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          value === option.value ? "border-primary bg-muted" : "",
        )}
        tabindex={0}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            value = option.value;
          }
        }}
      >
        {#if option.icon}
          {@const Icon = option.icon}
          <Icon class="mb-1 size-4" />
        {/if}
        <Text style="sm" class="leading-1">{option.title}</Text>
        <Text style="xs" class="text-muted-foreground leading-1.5">{option.description}</Text>
      </Label>
    </div>
  {/each}
</RadioGroup.Root>
