import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { ROUTES } from "$lib/const/routes";
import { auth } from "$lib/stores/auth";

export const refreshSession = async () => {
  if (!auth.isAuthenticated()) return;

  try {
    const refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    });

    auth.setRefreshPromise(refreshPromise);
    const response = await refreshPromise;

    if (!response.ok) {
      if (response.status === 401) {
        auth.setRefreshPromise(null);
        goto(resolve(ROUTES.LOGOUT));
        return;
      }
    }

    refreshUserData();
  } finally {
    auth.setRefreshPromise(null);
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

    if (!response.ok) {
      if (response.status === 401) {
        goto(resolve(ROUTES.LOGOUT));
        return;
      }
    }

    const data = await response.json();
    auth.setUser(data.user);
  } catch (error) {
    console.error("Failed to refresh user data", error);
  }
};
