import { describe, expect, it } from "vitest";

import * as partyInvitationRoute from "./[invitationId]/route";
import * as partyInvitationsRoute from "./route";

describe("party invitation route entries", () => {
  it("export only supported Next.js route fields", () => {
    expect(Object.keys(partyInvitationsRoute).sort()).toEqual([
      "POST",
      "dynamic",
      "runtime",
    ]);
    expect(Object.keys(partyInvitationRoute).sort()).toEqual([
      "DELETE",
      "PATCH",
      "dynamic",
      "runtime",
    ]);
  });
});
