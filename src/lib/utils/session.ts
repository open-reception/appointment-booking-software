import { goto } from "$app/navigation";
import { ROUTES } from "$lib/const/routes";
import { auth } from "$lib/stores/auth";

export const refreshSession = async () => {
  if (!auth.isAuthenticated()) return;

  auth.setRefreshing(true);

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    });

    if (!response.ok) {
      // Token is invalid, clear and redirect to login
      if (response.status === 401) {
        auth.setRefreshing(false);
        goto(ROUTES.LOGOUT);
        return;
      }
    }

    refreshUserData();
  } finally {
    auth.setRefreshing(false);
  }
};

export const refreshUserData = async () => {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    });

    const data = await response.json();
    auth.setUser(data.user);
  } catch (error) {
    console.error("Failed to refresh user data", error);
  }
};
