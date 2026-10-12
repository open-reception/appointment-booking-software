<script lang="ts">
  import { m } from "$i18n/messages";
  import { type SelectAppointmentProgress } from "$lib/server/db/tenant-schema";
  import { getCurrentTranslation } from "$lib/utils/localizations";
  import AppointmentProgressIcon from "./AppointmentProgressIcon.svelte";

  let {
    state,
  }: {
    state: SelectAppointmentProgress;
  } = $props();
</script>

<AppointmentProgressIcon icon={state.icon} />
{getCurrentTranslation(state.names) || m["unknown"]()}
