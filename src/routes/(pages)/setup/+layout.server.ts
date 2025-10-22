import { ROUTES } from "$lib/const/routes.js";
import { UserService } from "$lib/server/services/user-service";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
  // Some routes should not be accessed, once an admin is created
  const cleanedId = event.route.id.replace("/(pages)", "");
  const blocklist = [ROUTES.SETUP.MAIN, ROUTES.SETUP.CREATE_ADMIN_ACCOUNT, ROUTES.LOGIN];

  // Check if global admin exists
  const adminExists = await UserService.adminExists();
  if (blocklist.includes(cleanedId) && adminExists) {
    redirect(302, ROUTES.LOGIN);
  }
};
