import { useEffect, useState } from 'react';
import { getContext } from '@microsoft/power-apps/app';
import { useCurrentUserTeams } from '@/hooks/usePrototypeData';
import { AI_COE_FULL_TEAM_NAME } from '@/constants/security';

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
 * Determines whether the signed-in user is a CoE administrator by checking
 * membership in the "AI CoE Team Full" Dataverse owner team. This mirrors the
 * platform security model: members of that team hold the full-access security
 * role and therefore administer the solution. The AI CoE Roles application
 * data (`afp_aicoeroles`) is unrelated and is not consulted here.
 *
 * While the team membership is still loading, `isLoading` is true and
 * `isAdmin` is false. Admin-only UI should stay hidden until this resolves to
 * avoid a flash of restricted navigation.
 */
export function useIsCoeAdmin() {
  const { data: teams = [], isLoading } = useCurrentUserTeams();

  const isAdmin = teams.some((name) => name.trim() === AI_COE_FULL_TEAM_NAME);

  return { isAdmin, isLoading };
}