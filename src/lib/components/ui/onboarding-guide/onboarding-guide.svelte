<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";
  import { Button, type ButtonVariant } from "../button";
  import { Headline, Text } from "../typography";
  import DoneIcon from "@lucide/svelte/icons/check";

  type Step = {
    title: string;
    description?: string;
    actions?: {
      label: string;
      onClick?: (e: MouseEvent) => void;
      href?: string;
      variant?: ButtonVariant;
    }[];
    isDone: boolean;
  };

  type Props = {
    title: string;
    steps: Step[];
  };

  let { title, steps }: Props = $props();
</script>

<div class="flex max-w-[50ch] flex-col gap-4">
  <Headline level="h2" style="h4">{title}</Headline>
  <div class="flex flex-col gap-4">
    {#each steps as step, index (`step-${index}`)}
      <div class="flex flex-col gap-1">
        <div class="flex">
          <div
            class="border-primary mr-3 flex size-5 shrink-0 items-center justify-center rounded-full border"
            class:bg-primary={step.isDone}
          >
            {#if step.isDone}
              <DoneIcon class="text-secondary size-2.5" strokeWidth={4} />
            {/if}
          </div>
          <Text style="md">
            {step.title}
          </Text>
        </div>
        <div class="flex flex-col gap-2 pl-8">
          {#if step.description && !step.isDone}
            <Text style="sm" class="text-muted-foreground">
              {step.description}
            </Text>
          {/if}
          {#if step.actions && !step.isDone}
            <div class="mt-2 flex max-w-100 justify-between gap-2">
              {#each step.actions as action, index (`action-${index}`)}
                <Button
                  variant={action.variant}
                  href={action.href}
                  onclick={action.onClick}
                  class="w-full"
                >
                  {action.label}
                </Button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
