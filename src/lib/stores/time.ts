import { getLocalTimeZone, now } from "@internationalized/date";
import { readable } from "svelte/store";

export const clock = readable(now(getLocalTimeZone()), (set) => {
  const tick = () => set(now(getLocalTimeZone()));
  const id = setInterval(tick, 10_000);
  tick();
  return () => clearInterval(id);
});
