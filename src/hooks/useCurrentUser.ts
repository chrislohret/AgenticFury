import { useEffect, useState } from 'react';
import { getContext } from '@microsoft/power-apps/app';
import { useAiCoeTeam } from '@/hooks/usePrototypeData';

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

/**
 * Determines whether the signed-in user is a CoE administrator by matching
 * their email against the AI CoE Team roster. While either source is still
 * loading, `isLoading` is true and `isAdmin` is false. Admin-only UI should
 * stay hidden until this resolves to avoid a flash of restricted navigation.
 */
export function useIsCoeAdmin() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: members = [], isLoading: membersLoading } = useAiCoeTeam();

  const email = user?.email?.trim().toLowerCase();
  const isAdmin = Boolean(
    email && members.some((m) => m.userEmail?.trim().toLowerCase() === email),
  );

  return { isAdmin, isLoading: userLoading || membersLoading };
}