export const ROUTES = {
  MAIN: "/",
  BOOK_APPOINTMENT: "/book-appointment",
  APPOINTMENT_BOOKED: "/book-appointment/complete",
  SETUP: {
    MAIN: "/setup",
    CREATE_ADMIN_ACCOUNT: "/setup/create-admin-account",
    CHECK_EMAIL: "/setup/check-email",
  },
  SETUP_PASSKEY: "/confirm/setup-passkey",
  RESEND_CONFIRMATION: "/confirm/resend",
  CLIENTS: {
    MAIN: "/clients",
    LOGIN: "/clients/login",
  },
  LOGIN: "/login",
  LOGOUT: "/logout",
  DASHBOARD: {
    MAIN: "/dashboard",
    TENANTS: "/dashboard/tenants",
    CALENDAR: "/dashboard/calendar",
    STAFF: "/dashboard/staff",
    AGENTS: "/dashboard/agents",
    CHANNELS: "/dashboard/channels",
    CHANNEL: "/dashboard/channels/[channelId]",
    CHANNEL_SLOTS: "/dashboard/channels/[channelId]/slots",
    CHANNEL_PUBLIC_BOOKING: "/dashboard/channels/[channelId]/public-booking",
    ABSENCES: "/dashboard/absences",
    SETTINGS: "/dashboard/settings",
    ACCOUNT: {
      MAIN: "/dashboard/account",
      GENERAL: "/dashboard/account/general",
      PASSKEYS: "/dashboard/account/passkeys",
      CHANGE_EMAIL: "/dashboard/account/change-email",
      CHANGE_PASSPHRASE: "/dashboard/account/change-passphrase",
    },
  },
} as const;

export const getChannelRoute = (
  channelRoute:
    | typeof ROUTES.DASHBOARD.CHANNEL
    | typeof ROUTES.DASHBOARD.CHANNEL_SLOTS
    | typeof ROUTES.DASHBOARD.CHANNEL_PUBLIC_BOOKING,
  channelId: string,
): string => {
  return channelRoute.replace("[channelId]", channelId);
};
