export type TTenant = {
  id: string;
  shortName: string;
  longName: string;
  setupState: "NEW" | "SETTINGS_CREATED" | "AGENTS_SET_UP" | "FIRST_CHANNEL_CREATED";
};
