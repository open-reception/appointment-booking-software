<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { Calendar, Languages, Mail, Phone, User, UserStar } from "@lucide/svelte";
  import type { TAddAppointment, TAddAppointmentStep } from "./types";
  import * as Select from "$lib/components/ui/select";
  import { tenants } from "$lib/stores/tenants";
  import { languageSwitchLocales } from "$lib/const/locales";

  let {
    step,
    newAppointment,
    onChangeLocale,
  }: {
    step: TAddAppointmentStep;
    newAppointment: TAddAppointment;
    onChangeLocale: (locale: string) => void;
  } = $props();

  let agent = $derived($agentsStore.agents.find((a) => a.id === newAppointment.agentId));
  let languages = $derived($tenants.currentTenant?.languages);
</script>

<div class="flex flex-col items-start gap-3">
  <div class="flex gap-2">
    <Calendar class="size-4 " />
    <Text style="sm">
      {toDisplayDateTime(newAppointment.dateTime, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </Text>
  </div>
  {#if newAppointment.name}
    <div class="flex gap-2">
      <User class="size-4 " />
      <Text style="sm">
        {newAppointment.name}
      </Text>
    </div>
  {/if}
  {#if newAppointment.email}
    <div class="flex w-auto items-center justify-start gap-2">
      <Languages class="size-4" />
      <Select.Root type="single" onValueChange={onChangeLocale} value={newAppointment.locale}>
        <Select.Trigger
          class="h-1! w-full grow border-0 py-0 pl-1 font-medium shadow-none"
          size="sm"
        >
          {@const locale = newAppointment.locale
            ? languageSwitchLocales[newAppointment.locale as keyof typeof languageSwitchLocales]
            : undefined}
          {locale ? locale.label : "Select language"}
        </Select.Trigger>
        <Select.Content>
          {#each languages as language (language)}
            <Select.Item value={language}>
              {languageSwitchLocales[language as keyof typeof languageSwitchLocales].label}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    <Button
      class="h-auto w-auto justify-start gap-2 rounded-sm"
      variant="link"
      href={`mailto:${newAppointment.email}`}
    >
      <Mail class="size-4 " />
      {newAppointment.email}
    </Button>
  {/if}
  {#if newAppointment.phone}
    <Button
      class="h-auto w-auto justify-start gap-2 rounded-sm p-1"
      variant="link"
      href={`tel:${newAppointment.phone}`}
    >
      <Phone class="size-4 " />
      {newAppointment.phone}
    </Button>
  {/if}
  {#if agent}
    <div class="flex gap-2">
      <UserStar class="size-4 " />
      <Text style="sm">
        {agent.name}
      </Text>
    </div>
  {/if}
</div>
<div class="my-5">
  {#if step !== "summary"}
    <Separator />
  {/if}
</div>
