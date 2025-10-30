import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
  if (params.id) {
    return {
      channelId: params.id,
    };
  } else {
    return {
      channelId: undefined,
    };
  }
};
