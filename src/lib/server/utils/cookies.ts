import type { ServerLoadEvent } from "@sveltejs/kit";

export const removeAuthCookies = (event: ServerLoadEvent) => {
  event.cookies.delete("access_token", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
};
