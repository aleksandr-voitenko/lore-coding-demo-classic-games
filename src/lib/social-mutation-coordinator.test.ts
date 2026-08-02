import { describe, expect, it, vi } from "vitest";

import {
  SocialMutationAccountChangedError,
  SocialMutationCoordinator,
} from "./social-mutation-coordinator";

function createDeferred<Value>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    reject = promiseReject;
    resolve = promiseResolve;
  });

  return { promise, reject, resolve };
}

describe("social mutation coordinator", () => {
  it("publishes pending keys and blocks a duplicate action", async () => {
    const account = { accountEpoch: 1, userId: "user-a" };
    const coordinator = new SocialMutationCoordinator(account);
    const mutation = createDeferred<string>();
    const listener = vi.fn();
    coordinator.subscribe(listener);
    const result = coordinator.run(
      account,
      "friend:user-b",
      () => mutation.promise,
      () => true,
    );

    expect(coordinator.getSnapshot()).toEqual({
      accountEpoch: 1,
      pendingKeys: new Set(["friend:user-b"]),
      userId: "user-a",
    });
    await expect(
      coordinator.run(
        account,
        "friend:user-b",
        async () => "duplicate",
        () => true,
      ),
    ).rejects.toThrow("already in progress");

    mutation.resolve("accepted");
    await expect(result).resolves.toBe("accepted");
    expect(coordinator.getSnapshot()).toEqual({
      accountEpoch: 1,
      pendingKeys: new Set(),
      userId: "user-a",
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not expose an old account's successful or failed result", async () => {
    const accountA = { accountEpoch: 1, userId: "user-a" };
    const coordinator = new SocialMutationCoordinator(accountA);
    const successfulMutation = createDeferred<{ capability: string }>();
    const failedMutation = createDeferred<never>();
    const oldSuccess = coordinator.run(
      accountA,
      "invite:1",
      () => successfulMutation.promise,
      () => true,
    );
    const oldFailure = coordinator.run(
      accountA,
      "invite:2",
      () => failedMutation.promise,
      () => true,
    );

    coordinator.setAccount({ accountEpoch: 2, userId: "user-b" });
    successfulMutation.resolve({ capability: "secret-a" });
    failedMutation.reject(new Error("private error for A"));

    await expect(oldSuccess).rejects.toBeInstanceOf(
      SocialMutationAccountChangedError,
    );
    await expect(oldFailure).rejects.toBeInstanceOf(
      SocialMutationAccountChangedError,
    );
  });

  it("cannot clear a new account's same-key pending action", async () => {
    const accountA = { accountEpoch: 1, userId: "user-a" };
    const accountB = { accountEpoch: 2, userId: "user-b" };
    const coordinator = new SocialMutationCoordinator(accountA);
    const oldMutation = createDeferred<string>();
    const newMutation = createDeferred<string>();
    const oldResult = coordinator.run(
      accountA,
      "invite:1",
      () => oldMutation.promise,
      () => true,
    );

    coordinator.setAccount(accountB);
    const newResult = coordinator.run(
      accountB,
      "invite:1",
      () => newMutation.promise,
      () => true,
    );
    oldMutation.resolve("old");
    await expect(oldResult).rejects.toBeInstanceOf(
      SocialMutationAccountChangedError,
    );
    expect(coordinator.getSnapshot()).toEqual({
      accountEpoch: 2,
      pendingKeys: new Set(["invite:1"]),
      userId: "user-b",
    });

    newMutation.resolve("new");
    await expect(newResult).resolves.toBe("new");
  });

  it("rejects signed-out mutation attempts", async () => {
    const signedOutAccount = { accountEpoch: 1, userId: null };
    const coordinator = new SocialMutationCoordinator(signedOutAccount);

    await expect(
      coordinator.run(
        signedOutAccount,
        "invite:1",
        async () => "never",
        () => true,
      ),
    ).rejects.toThrow("Sign in");
  });

  it("rejects a stale runner before it can reset or mutate the active account", async () => {
    const accountA = { accountEpoch: 1, userId: "user-a" };
    const accountB = { accountEpoch: 2, userId: "user-b" };
    const coordinator = new SocialMutationCoordinator(accountA);
    const mutation = vi.fn(async () => "secret-a");

    coordinator.setAccount(accountB);

    await expect(
      coordinator.run(accountA, "invite:1", mutation, () => false),
    ).rejects.toBeInstanceOf(SocialMutationAccountChangedError);
    expect(mutation).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot()).toEqual({
      accountEpoch: 2,
      pendingKeys: new Set(),
      userId: "user-b",
    });
  });

  it("rejects a settlement once the synchronous account epoch changes", async () => {
    const accountA = { accountEpoch: 1, userId: "user-a" };
    const coordinator = new SocialMutationCoordinator(accountA);
    const mutation = createDeferred<{ capability: string }>();
    let isCurrent = true;
    const result = coordinator.run(
      accountA,
      "invite:1",
      () => mutation.promise,
      () => isCurrent,
    );

    isCurrent = false;
    mutation.resolve({ capability: "secret-a" });

    await expect(result).rejects.toBeInstanceOf(
      SocialMutationAccountChangedError,
    );
  });
});
