export const changeTenantUsingApi = async (tenantId: string | null): Promise<boolean> => {
  const response = await fetch("/api/admin/tenant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok && response.status < 300) {
    return true;
  }

  return false;
};
