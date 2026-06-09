import { useEffect, useState } from 'react';
import { getContext } from '@microsoft/power-apps/app';

export interface CurrentUser {
  id: string;
  fullName: string;
  email?: string;
}

const MOCK_CURRENT_USER: CurrentUser = {
  id: 'user-mock-1',
  fullName: 'Chris Lohret',
  email: 'chris.lohret@microsoft.com',
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (import.meta.env.VITE_USE_MOCK === 'true') {
      setUser(MOCK_CURRENT_USER);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    void getContext()
      .then((context) => {
        if (!active) return;
        setUser({
          id: context.user.objectId ?? context.user.userPrincipalName ?? '',
          fullName: context.user.fullName ?? context.user.userPrincipalName ?? 'Current user',
          email: context.user.userPrincipalName,
        });
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { data: user, isLoading };
}