<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { InputDateTime } from "$lib/components/ui/input-date-time";
  import * as Select from "$lib/components/ui/select";
  import { agents as agentsStore } from "$lib/stores/agents";
  import type { TAbsence } from "$lib/types/absence";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import { reasons, types } from "../utils";
  import {
    timeLocalWithoutOffsetToUTC,
    timeUTCToLocalWithoutOffset,
    toInputDateTime,
    toWeekdaysLabel,
    weekdays,
  } from "$lib/utils/datetime";
  import { SvelteDate } from "svelte/reactivity";
  import { times } from "$lib/components/ui/slot-template/utils";
  import { RadioCards } from "$lib/components/ui/radio-cards";
  import { cn } from "$lib/utils";

  let { entity, done }: { entity: TAbsence; done: () => void } = $props();

  const agents = $derived($agentsStore.agents ?? []);

  // svelte-ignore state_referenced_locally
  const form = superForm(
    {
      type: entity.type,
      id: entity.id,
      agent: entity.agentId,
      absenceType: entity.absenceType,
      startDate: entity.startDate,
      endDate: entity.endDate,
      weekdays: entity.weekdays || null,
      from: entity.from || null,
      to: entity.to || null,
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["absences.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          if (event.result.status === 409) {
            toast.error(m["absences.edit.errors.conflict"]());
          } else {
            toast.error(m["absences.edit.errors.unknown"]());
          }
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);
  // svelte-ignore state_referenced_locally
  let startDate = $state(toInputDateTime(entity.startDate));
  // svelte-ignore state_referenced_locally
  let endDate = $state(toInputDateTime(entity.endDate));
  let isAllDay = $state(
    startDate.hour === 0 &&
      startDate.minute === 0 &&
      startDate.second === 0 &&
      endDate.hour === 23 &&
      endDate.minute === 59 &&
      endDate.second === 59,
  );
  let endDateTouched = $state(false);

  const { form: formData, enhance } = form;

  const onWeekdaysChange = (values: string[]) => {
    const newValue = values.map((v) => parseInt(v)).reduce((sum, x) => sum + x, 0);
    $formData.weekdays = newValue;
  };
  const toSelectedWeekdays = (bitmap: number | null) => {
    if (bitmap == null || bitmap === 0) return [];
    return weekdays.filter(({ bit }) => (bitmap & bit) === bit).map(({ bit }) => `${bit}`);
  };
  const getSelectedTime = (utcTime: string) => {
    const localTime = timeUTCToLocalWithoutOffset(utcTime) as keyof typeof times;
    return times[localTime]?.label ?? "";
  };
</script>

<Form.Root {enhance} action="?/edit">
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <Form.Field {form} name="type">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.type.title"]()}</Form.Label>
        <RadioCards
          {...props}
          bind:value={$formData.type}
          options={Object.values(types)}
          onValueChange={(v) => {
            if (v === "REGULAR") {
              isAllDay = true;
              $formData.absenceType = "OTHER";
              $formData.weekdays = 0;
              $formData.from = timeLocalWithoutOffsetToUTC("09:00:00");
              $formData.to = timeLocalWithoutOffsetToUTC("17:00:00");
            } else {
              $formData.weekdays = null;
              $formData.from = null;
              $formData.to = null;
              $formData.absenceType = "VACATION";
            }
          }}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="agent">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.agent.title"]()}</Form.Label>
        <Select.Root
          type="single"
          bind:value={$formData.agent}
          name={props.name}
          onValueChange={(v) => ($formData.agent = v)}
          disabled={true}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.agent
              ? agents.find((x) => x.id === $formData.agent)?.name
              : m["absences.add.fields.agent.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each agents as agent (agent.id)}
              <Select.Item value={agent.id}>{agent.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="absenceType" class={$formData.type === "REGULAR" ? "hidden" : ""}>
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.absenceType.title"]()}</Form.Label>
        <Select.Root
          type="single"
          bind:value={$formData.absenceType}
          name={props.name}
          onValueChange={(v) => ($formData.absenceType = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.absenceType
              ? reasons.find((x) => x.value === $formData.absenceType)?.label
              : m["absences.add.fields.absenceType.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each reasons as reason (reason.value)}
              <Select.Item value={reason.value}>{reason.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <CheckboxWithLabel
    bind:value={isAllDay}
    label={m["absences.add.fields.isAllDay.label"]()}
    onCheckedChange={(v) => {
      isAllDay = v;
      if (v) {
        setTimeout(() => (endDateTouched = false), 100);
      }
    }}
    class={cn("mt-2 mb-1", $formData.type === "REGULAR" ? "hidden" : "")}
  />
  <div class={cn($formData.type === "REGULAR" ? "grid grid-cols-2 gap-2" : "")}>
    <Form.Field {form} name="startDate">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["absences.add.fields.startDate.title"]()}</Form.Label>
          <InputDateTime
            {...props}
            type={isAllDay ? "date" : "datetime-local"}
            bind:value={$formData.startDate}
            defaultTime={{ hour: 0, minute: 0, second: 0 }}
            onChanged={() => {
              if (!endDateTouched && $formData.endDate <= $formData.startDate) {
                if (!isAllDay) {
                  const startDate = new SvelteDate($formData.startDate);
                  const endDate = new Date($formData.endDate);
                  startDate.setHours(
                    endDate.getHours(),
                    endDate.getMinutes(),
                    endDate.getSeconds(),
                    endDate.getMilliseconds(),
                  );
                  $formData.endDate = startDate.toISOString();
                } else {
                  const startDate = new SvelteDate($formData.startDate);
                  startDate.setHours(23, 59, 59, 999);
                  $formData.endDate = startDate.toISOString();
                }
              }
            }}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="endDate">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["absences.add.fields.endDate.title"]()}</Form.Label>
          <InputDateTime
            {...props}
            type={isAllDay ? "date" : "datetime-local"}
            bind:value={$formData.endDate}
            defaultTime={{ hour: 23, minute: 59, second: 59 }}
            onChanged={() => (endDateTouched = true)}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
  {#if $formData.type === "REGULAR"}
    <Form.Field {form} name="weekdays">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["components.slotTemplate.weekdays"]()}</Form.Label>
          <Select.Root
            type="multiple"
            onValueChange={onWeekdaysChange}
            name={props.name}
            value={toSelectedWeekdays($formData.weekdays)}
          >
            <Select.Trigger {...props} class="w-full">
              {toWeekdaysLabel($formData.weekdays)}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={weekdays[0].bit.toString()}>{weekdays[0].day}</Select.Item>
              <Select.Item value={weekdays[1].bit.toString()}>{weekdays[1].day}</Select.Item>
              <Select.Item value={weekdays[2].bit.toString()}>{weekdays[2].day}</Select.Item>
              <Select.Item value={weekdays[3].bit.toString()}>{weekdays[3].day}</Select.Item>
              <Select.Item value={weekdays[4].bit.toString()}>{weekdays[4].day}</Select.Item>
              <Select.Item value={weekdays[5].bit.toString()}>{weekdays[5].day}</Select.Item>
              <Select.Item value={weekdays[6].bit.toString()}>{weekdays[6].day}</Select.Item>
            </Select.Content>
          </Select.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <div class="flex gap-2">
      <Form.Field {form} name="from" class="flex-1">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["components.slotTemplate.from"]()}</Form.Label>
            <Select.Root type="single" name={props.name} bind:value={$formData.from as string}>
              <Select.Trigger {...props} class="w-full">
                {getSelectedTime($formData.from as keyof typeof times)}
              </Select.Trigger>
              <Select.Content>
                {#each Object.entries(times) as [time, value] (time)}
                  <Select.Item value={timeLocalWithoutOffsetToUTC(time)}>{value.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="to" class="flex-1">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["components.slotTemplate.to"]()}</Form.Label>
            <Select.Root type="single" name={props.name} bind:value={$formData.to as string}>
              <Select.Trigger {...props} class="w-full">
                {getSelectedTime($formData.to as keyof typeof times)}
              </Select.Trigger>
              <Select.Content>
                {#each Object.entries(times) as [time, value] (time)}
                  <Select.Item value={timeLocalWithoutOffsetToUTC(time)}>{value.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
  {/if}
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["absences.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
