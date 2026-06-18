export type Error = { success: false; isSetup: boolean };
export type Success = {
  success: true;
  isSetup: boolean;
  id: string;
  email: string;
  tenantId: string | null;
};
