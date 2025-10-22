import { ROUTES } from "$lib/const/routes.js";
import { UserService } from "$lib/server/services/user-service";
import { redirect } from "@sveltejs/kit";

export const load = async () => {
  // Check if global admin exists
  // If not, redirect to setup page
  const adminExists = await UserService.adminExists();
  if (!adminExists) {
    redirect(302, ROUTES.SETUP.MAIN);
  }
};
