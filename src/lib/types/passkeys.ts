export type RedactedPasskey = {
  id: string;
  deviceName: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export type RedactedPasskeyHydrated = Pick<RedactedPasskey, "id" | "deviceName"> & {
  createdAt: Date | null;
  lastUsedAt: Date | null;
};
