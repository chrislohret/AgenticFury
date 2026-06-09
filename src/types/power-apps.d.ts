declare module '@microsoft/power-apps/app' {
  export interface PowerAppsUserContext {
    objectId?: string;
    userPrincipalName?: string;
    fullName?: string;
  }

  export interface PowerAppsContext {
    user: PowerAppsUserContext;
  }

  export function getContext(): Promise<PowerAppsContext>;
}
