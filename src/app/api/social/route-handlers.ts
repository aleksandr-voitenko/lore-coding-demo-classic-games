import "server-only";

import {
  MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS,
  type MultiplayerAccountPartyAuthority,
} from "@/lib/server/multiplayer-account-party";
import type { SqliteSocialStore } from "@/lib/server/sqlite-social-store";
import type { SocialAvailability } from "@/lib/social";

import {
  authenticateSocialRequest,
  createSocialJsonResponse,
  createSocialStoreFailureResponse,
  type SocialUserSessionLookup,
} from "./shared";

type SocialOverviewStore = Pick<
  SqliteSocialStore,
  | "getOverview"
  | "getPendingPartyInvitationsForReconciliation"
  | "revokePartyInvitationsForParty"
>;
type SocialAvailabilityAuthority = Pick<
  MultiplayerAccountPartyAuthority,
  "applyAccountCommand"
>;

function chunkUserIds(userIds: string[]) {
  const chunks: string[][] = [];

  for (
    let index = 0;
    index < userIds.length;
    index += MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS
  ) {
    chunks.push(
      userIds.slice(
        index,
        index + MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS,
      ),
    );
  }

  return chunks;
}

async function resolveAvailabilityChunk(
  accountAuthority: SocialAvailabilityAuthority,
  userIds: string[],
) {
  try {
    return await accountAuthority.applyAccountCommand({
      type: "presence.resolve",
      userIds,
    });
  } catch {
    return null;
  }
}

const TERMINAL_PARTY_FAILURES = new Set([
  "party-closed",
  "room-expired",
  "room-not-found",
]);

const PARTY_INVITATION_RECONCILIATION_CONCURRENCY = 4;

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapItem: (item: TItem) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await mapItem(items[itemIndex] as TItem);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(concurrency, items.length),
      },
      () => runWorker(),
    ),
  );

  return results;
}

export function createSocialOverviewRouteHandlers(
  socialStore: SocialOverviewStore,
  userStore: SocialUserSessionLookup,
  accountAuthority: SocialAvailabilityAuthority,
) {
  return {
    async GET(request: Request) {
      const authentication = await authenticateSocialRequest(
        request,
        userStore,
      );

      if (!authentication.success) {
        return authentication.response;
      }

      const reconciliation =
        await socialStore.getPendingPartyInvitationsForReconciliation(
          authentication.user.id,
        );

      if (!reconciliation.success) {
        return createSocialStoreFailureResponse(reconciliation);
      }

      const inspections = await mapWithConcurrency(
        reconciliation.invitations,
        PARTY_INVITATION_RECONCILIATION_CONCURRENCY,
        async (invitation) => {
          try {
            const result = await accountAuthority.applyAccountCommand({
              hostUserId: invitation.inviter.id,
              intent: invitation.intent,
              partyCode: invitation.partyCode,
              recipientUserId: invitation.recipient.id,
              type: "party.inspectInvitation",
            });

            return { invitation, result };
          } catch {
            return { invitation, result: null };
          }
        },
      );
      const terminalPartyCodes = new Set<string>();

      for (const { invitation, result: inspection } of inspections) {
        if (inspection === null) {
          continue;
        }

        if (!inspection.success) {
          if (TERMINAL_PARTY_FAILURES.has(inspection.code)) {
            terminalPartyCodes.add(invitation.partyCode);
          }

          continue;
        }
      }

      for (const partyCode of terminalPartyCodes) {
        const revocation =
          await socialStore.revokePartyInvitationsForParty(partyCode);

        if (!revocation.success) {
          return createSocialStoreFailureResponse(revocation);
        }
      }

      const result = await socialStore.getOverview(authentication.user.id);

      if (!result.success) {
        return createSocialStoreFailureResponse(result);
      }

      const availabilityByUserId = new Map<string, SocialAvailability>();
      const friendUserIds = result.overview.friends.map(
        (friend) => friend.user.id,
      );
      const resolutionResults = await mapWithConcurrency(
        chunkUserIds(friendUserIds),
        PARTY_INVITATION_RECONCILIATION_CONCURRENCY,
        (userIds) => resolveAvailabilityChunk(accountAuthority, userIds),
      );

      for (const resolution of resolutionResults) {
        if (
          resolution?.success &&
          resolution.outcome === "availability"
        ) {
          for (const entry of resolution.availabilities) {
            availabilityByUserId.set(entry.userId, entry.availability);
          }
        }
      }

      return createSocialJsonResponse({
        overview: {
          ...result.overview,
          friends: result.overview.friends.map((friend) => ({
            ...friend,
            availability:
              availabilityByUserId.get(friend.user.id) ?? "unknown",
          })),
        },
      });
    },
  };
}
