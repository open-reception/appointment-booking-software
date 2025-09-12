import type { Component } from "svelte";
import SidebarLayout from "./root.svelte";
import type { UserRole } from "$lib/server/auth/authorization-service";

export { SidebarLayout };

export type NavItem = {
  title: string;
  url: string;
  isTenantOnly?: boolean;
  icon: Component;
  roles: UserRole[];
};
