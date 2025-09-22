<script lang="ts">
  import { browser } from "$app/environment";
  import { Button } from "$lib/components/ui/button";
  import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import type { CropperImage } from "cropperjs";
  import { onDestroy } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";
  import {
    ZoomIn,
    ZoomOut,
    MoveLeft,
    MoveUp,
    MoveRight,
    MoveDown,
    Trash,
  } from "@lucide/svelte/icons";
  import type { Component } from "svelte";
  import { Text } from "../typography";
  import { Input } from "../input";
  import { m } from "$i18n/messages";

  type Selection = {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type CropperSelectionChangeEvent = CustomEvent<{
    detail: Selection;
  }>;
  type Matrix = [number, number, number, number, number, number];
  type CropperImageTransformEvent = CustomEvent<{
    detail: Matrix;
  }>;

  type Props = Omit<HTMLInputAttributes, "type" | "files"> & {
    FallbackIcon: Component;
    value?: string | File | null;
    aspectRatio?: number;
    width?: number;
    height?: number;
  };

  let {
    FallbackIcon,
    value = $bindable(),
    aspectRatio = 1,
    width = 300,
    height = 300,
    ...restProps
  }: Props = $props();

  let fileInput: HTMLInputElement;
  let imageElement: HTMLDivElement;
  let CropperClass: unknown = null;
  let cropperInstance: unknown = null;
  let cropperCanvas: HTMLCanvasElement | null = null;
  let cropperImage: HTMLElement | null = null;
  let cropperSelection: HTMLElement | null = null;
  let previewUrl = $state<string | null>(null);
  let dialogOpen = $state(false);

  const handleFileSelect = async (
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
  ) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file && file.type.startsWith("image/")) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrl = URL.createObjectURL(file);

      dialogOpen = true;

      if (browser) {
        const CropperModule = await import("cropperjs");
        CropperClass = CropperModule.default;
        setTimeout(() => {
          // @ts-expect-error types are not available
          cropperInstance = new CropperClass(imageElement, {
            template: `<cropper-canvas background class="w-full">
  <cropper-image style="width: 100%;" rotatable scalable skewable translatable></cropper-image>
  <cropper-shade theme-color="rgba(0, 0, 0, 0.35)"></cropper-shade>
  <cropper-handle action="select" plain></cropper-handle>
  <cropper-selection width="${width}" height="${height}" initial-coverage="0.5" aspect-ratio=${aspectRatio} movable resizable keyboard>
    <cropper-grid role="grid" bordered covered theme-color="rgba(0, 0, 0, 0.5)"></cropper-grid>
    <cropper-crosshair centered theme-color="rgba(0, 0, 0, 0.5)"></cropper-crosshair>
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0)"></cropper-handle>
    <cropper-handle action="ne-resize" theme-color="rgba(0, 0, 0, 0.85)"></cropper-handle>
    <cropper-handle action="nw-resize" theme-color="rgba(0, 0, 0, 0.85)"></cropper-handle>
    <cropper-handle action="se-resize" theme-color="rgba(0, 0, 0, 0.85)"></cropper-handle>
    <cropper-handle action="sw-resize" theme-color="rgba(0, 0, 0, 0.85)"></cropper-handle>
  </cropper-selection>
</cropper-canvas>`,
          });

          // @ts-expect-error types are not available
          cropperCanvas = cropperInstance.getCropperCanvas();
          // @ts-expect-error types are not available
          cropperImage = cropperInstance.getCropperImage();
          // @ts-expect-error types are not available
          cropperSelection = cropperInstance.getCropperSelection();

          setTimeout(() => {
            cropperSelection?.addEventListener("change", (e) =>
              onCropperSelectionChange(e as CropperSelectionChangeEvent),
            );
            cropperImage?.addEventListener("transform", (e) =>
              onCropperImageTransform(e as CropperImageTransformEvent),
            );
          }, 100);
        }, 100);
      }
    }
  };

  const onCropperSelectionChange = (event: CropperSelectionChangeEvent) => {
    if (!cropperCanvas || !cropperImage || !cropperSelection) return;

    const cropperCanvasRect = cropperCanvas.getBoundingClientRect();
    // @ts-expect-error somehow types are read incorrectly
    const selection = event.detail as Selection;
    const cropperImageRect = cropperImage.getBoundingClientRect();
    const maxSelection = {
      x: cropperImageRect.left - cropperCanvasRect.left,
      y: cropperImageRect.top - cropperCanvasRect.top,
      width: cropperImageRect.width,
      height: cropperImageRect.height,
    };

    if (
      selection.x < maxSelection.x ||
      selection.y < maxSelection.y ||
      selection.x + selection.width > maxSelection.x + maxSelection.width ||
      selection.y + selection.height > maxSelection.y + maxSelection.height
    ) {
      event.preventDefault();
    }
  };

  const onCropperImageTransform = (event: CropperImageTransformEvent) => {
    if (!cropperCanvas || !cropperImage || !cropperSelection) return;

    const cropperImageClone = cropperImage.cloneNode() as CropperImage;
    // @ts-expect-error somehow types are read incorrectly
    cropperImageClone.style.transform = `matrix(${event.detail.matrix.join(", ")})`;
    cropperImageClone.style.opacity = "0";
    cropperCanvas.appendChild(cropperImageClone);
    const cropperImageRect = cropperImageClone.getBoundingClientRect();
    cropperCanvas.removeChild(cropperImageClone);
    const selection = cropperSelection.getBoundingClientRect();
    const maxSelection = {
      x: cropperImageRect.left,
      y: cropperImageRect.top,
      width: cropperImageRect.width,
      height: cropperImageRect.height,
    };

    if (
      selection.x < maxSelection.x ||
      selection.y < maxSelection.y ||
      selection.x + selection.width > maxSelection.x + maxSelection.width ||
      selection.y + selection.height > maxSelection.y + maxSelection.height
    ) {
      event.preventDefault();
    }
  };

  const handleCrop = async () => {
    // @ts-expect-error types are not here
    const canvas = await cropperSelection?.$toCanvas({ width, height });
    canvas.toBlob(async (blob: Blob) => {
      if (!blob) return;
      value = await blobToBase64(blob);
      dialogOpen = false;
    });
  };

  function blobToBase64(blob: Blob): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (e) => {
        console.error("Error reading blob as base64", e);
        reject(null);
      };
      reader.readAsDataURL(blob);
    });
  }

  const handleButtonAction = (type: "zoom-in" | "zoom-out" | "left" | "up" | "right" | "down") => {
    switch (type) {
      case "zoom-in":
        // @ts-expect-error types are not available
        cropperImage?.$zoom(0.1);
        break;
      case "zoom-out":
        // @ts-expect-error types are not available
        cropperImage?.$zoom(-0.1);
        break;
      case "left":
        // @ts-expect-error types are not available
        cropperImage?.$move(-1, 0);
        break;
      case "up":
        // @ts-expect-error types are not available
        cropperImage?.$move(0, -1);
        break;
      case "right":
        // @ts-expect-error types are not available
        cropperImage?.$move(1, 0);
        break;
      case "down":
        // @ts-expect-error types are not available
        cropperImage?.$move(0, 1);
        break;
    }
  };

  onDestroy(() => {
    cropperSelection?.removeEventListener("change", (e) =>
      onCropperSelectionChange(e as CropperSelectionChangeEvent),
    );
    cropperImage?.removeEventListener("transform", (e) =>
      onCropperImageTransform(e as CropperImageTransformEvent),
    );
  });
</script>

<div class="flex justify-start gap-3">
  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg, image/png, image/gif, image/webp"
    class="hidden"
    onchange={handleFileSelect}
  />
  <div
    class="bg-muted border-lighter relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border-1"
  >
    {#if value}
      <Button
        size="xs"
        class="absolute top-1 right-1 cursor-pointer rounded-sm !px-1 py-1"
        onclick={() => (value = null)}
      >
        <Trash />
        <span class="sr-only">{m["components.inputCroppedImageBlob.remove"]()}</span>
      </Button>
      <img src={value} alt="Cropped version" class="h-full w-full" />
    {:else}
      <FallbackIcon class="text-muted-foreground size-10 stroke-1" />
    {/if}
  </div>
  <div class="mt-1 flex flex-col items-start">
    <Button style="sm" variant="ghost" class="px-2 py-1" onclick={() => fileInput?.click()}>
      {m["components.inputCroppedImageBlob.trigger"]()}
    </Button>
    <Text style="xs" color="medium" class="px-2">
      {m["components.inputCroppedImageBlob.description"]()}
    </Text>
  </div>
  <Input type="text" bind:value hidden {...restProps} />
</div>

<Dialog bind:open={dialogOpen}>
  <DialogContent class="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>
        {m["components.inputCroppedImageBlob.crop.title"]()}
      </DialogTitle>
    </DialogHeader>

    <div
      class="bg-muted relative flex min-h-[250px] w-full items-stretch overflow-hidden rounded-lg"
    >
      <img
        bind:this={imageElement}
        src={previewUrl}
        alt={m["components.inputCroppedImageBlob.crop.title"]()}
        class="hidden"
      />
    </div>
    <Text style="xs">{m["components.inputCroppedImageBlob.crop.description"]()}</Text>
    <div class="flex flex-col gap-0.5">
      <div class="flex flex-wrap gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onclick={() => handleButtonAction("zoom-in")}
        >
          <ZoomIn class="size-3" />
          {m["components.inputCroppedImageBlob.crop.zoomIn"]()}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onclick={() => handleButtonAction("zoom-out")}
        >
          <ZoomOut class="size-3" />
          {m["components.inputCroppedImageBlob.crop.zoomOut"]()}
        </Button>
      </div>
      <div class="flex flex-wrap gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onclick={() => handleButtonAction("left")}
        >
          <MoveLeft class="size-3" />
          {m["components.inputCroppedImageBlob.crop.moveLeft"]()}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onclick={() => handleButtonAction("right")}
        >
          <MoveRight class="size-3" />
          {m["components.inputCroppedImageBlob.crop.moveRight"]()}
        </Button>
        <Button type="button" variant="outline" size="xs" onclick={() => handleButtonAction("up")}>
          <MoveUp class="size-3" />
          {m["components.inputCroppedImageBlob.crop.moveUp"]()}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onclick={() => handleButtonAction("down")}
        >
          <MoveDown class="size-3" />
          {m["components.inputCroppedImageBlob.crop.moveDown"]()}
        </Button>
      </div>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
        {m["components.inputCroppedImageBlob.crop.cancel"]()}
      </Button>
      <Button type="button" onclick={handleCrop}>
        {m["components.inputCroppedImageBlob.crop.apply"]()}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
