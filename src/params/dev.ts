import { dev } from "$app/environment";
import type { ParamMatcher } from "@sveltejs/kit";

export const match: ParamMatcher = (param) => {
  // Doesn't have to be include, but needs to return a boolean
  return dev && param.includes("local-only");
};
