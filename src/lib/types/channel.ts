import type { SelectChannel } from "$lib/server/db/tenant-schema";
import type { SlotTemplateRequest } from "$lib/server/services/channel-service";

export type TNewSlotTemplate = SlotTemplateRequest;
export type TSlotTemplate = TNewSlotTemplate & { id: string };

export type TChannel = SelectChannel & {
  agentIds: string[];
  slotTemplates: (TSlotTemplate | TNewSlotTemplate)[];
};

export type TChannelWithFullAgents = Omit<TChannel, "agentIds"> & {
  agents: {
    id: string;
    name: string;
    // and more that we don't use in FE yet
  }[];
};
