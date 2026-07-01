<script lang="ts">
  interface Props {
    [key: string]: unknown;
  }

  let { ...rest }: Props = $props();
</script>

<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...rest}>
  <g
    id="calendar-week-workdays"
    stroke="none"
    fill="none"
    fill-rule="evenodd"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="1"
  >
    <g id="Group" stroke="currentColor">
      <line x1="8" y1="2" x2="8" y2="6" id="Path" stroke-width="2"></line>
      <line x1="16" y1="2" x2="16" y2="6" id="Path" stroke-width="2"></line>
      <line x1="16" y1="11" x2="16" y2="21" id="Path" stroke-width="2"></line>
      <rect id="Rectangle" stroke-width="2" x="3" y="4" width="18" height="18" rx="2"></rect>
      <line x1="3" y1="10" x2="21" y2="10" id="Path" stroke-width="2"></line>
    </g>
  </g>
</svg>
