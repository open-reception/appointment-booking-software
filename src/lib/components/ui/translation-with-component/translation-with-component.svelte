<script lang="ts">
  import type { Snippet } from "svelte";

  type Interpolation = {
    param: string;
    value: string | number;
    snippet?: Snippet<[value: string | number, param: string]>;
  };

  type Props = {
    translation: string;
    interpolations?: Interpolation[];
    children?: Snippet<[value: string | number, param: string]>;
  };

  let { translation, interpolations = [], children }: Props = $props();

  // Process the translation string and create segments
  function processTranslation(text: string, interpolations: Interpolation[]) {
    if (!text || interpolations.length === 0) {
      return [{ type: "text", content: text }];
    }

    const segments = [];
    let remaining = text;
    let currentIndex = 0;

    // Create a sorted list of all interpolation positions
    const positions = [];

    for (const interpolation of interpolations) {
      let index = remaining.indexOf(interpolation.param, currentIndex);
      while (index !== -1) {
        positions.push({
          index,
          param: interpolation.param,
          value: interpolation.value,
          snippet: interpolation.snippet,
        });
        index = remaining.indexOf(interpolation.param, index + interpolation.param.length);
      }
    }

    // Sort positions by index
    positions.sort((a, b) => a.index - b.index);

    // Build segments
    let lastIndex = 0;
    for (const pos of positions) {
      // Add text before interpolation
      if (pos.index > lastIndex) {
        segments.push({
          type: "text",
          content: remaining.substring(lastIndex, pos.index),
        });
      }

      // Add interpolation
      segments.push({
        type: "interpolation",
        param: pos.param,
        value: pos.value,
        snippet: pos.snippet,
      });

      lastIndex = pos.index + pos.param.length;
    }

    // Add remaining text
    if (lastIndex < remaining.length) {
      segments.push({
        type: "text",
        content: remaining.substring(lastIndex),
      });
    }

    return segments;
  }

  const segments = processTranslation(translation, interpolations);
</script>

{#each segments as segment}
  {#if segment.type === "text"}
    {segment.content}
  {:else if segment.snippet}
    {@render segment.snippet(segment.value, segment.param)}
  {:else if defaultSnippet && segment.value}
    {@render defaultSnippet(segment.value, segment.param)}
  {:else if children && segment.value}
    {@render children(segment.value, segment.param)}
  {:else}
    {segment.value}
  {/if}
{/each}

{#snippet defaultSnippet(value: string | number, param: string)}
  <em>{value}</em>
{/snippet}
