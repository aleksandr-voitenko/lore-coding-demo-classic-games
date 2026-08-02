export type SocialMutationSnapshot = {
  accountEpoch: number;
  pendingKeys: ReadonlySet<string>;
  userId: string | null;
};

type AccountMutationState = {
  accountEpoch: number;
  tokens: Map<string, symbol>;
  userId: string | null;
};

export type SocialMutationAccount = {
  accountEpoch: number;
  userId: string | null;
};

export class SocialMutationAccountChangedError extends Error {
  constructor() {
    super("The signed-in account changed during this social action.");
    this.name = "SocialMutationAccountChangedError";
  }
}

/**
 * Fences async social mutations to the account that started them. The token map
 * prevents an old account's settlement from clearing a newer account's action
 * with the same UI key.
 */
export class SocialMutationCoordinator {
  #account: AccountMutationState;
  readonly #listeners = new Set<() => void>();
  #snapshot: SocialMutationSnapshot;

  constructor({ accountEpoch, userId }: SocialMutationAccount) {
    this.#account = { accountEpoch, tokens: new Map(), userId };
    this.#snapshot = { accountEpoch, pendingKeys: new Set(), userId };
  }

  readonly getSnapshot = () => this.#snapshot;

  readonly subscribe = (listener: () => void) => {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  };

  setAccount({ accountEpoch, userId }: SocialMutationAccount) {
    if (
      this.#account.accountEpoch === accountEpoch &&
      this.#account.userId === userId
    ) {
      return;
    }

    this.#account = { accountEpoch, tokens: new Map(), userId };
    this.#publish();
  }

  async run<Result>(
    account: SocialMutationAccount,
    key: string,
    mutation: () => Promise<Result>,
    isAccountCurrent: () => boolean,
  ) {
    if (account.userId === null) {
      throw new Error("Sign in to use friends and party invitations.");
    }

    const mutationAccount = this.#account;

    if (
      !isAccountCurrent() ||
      mutationAccount.accountEpoch !== account.accountEpoch ||
      mutationAccount.userId !== account.userId
    ) {
      throw new SocialMutationAccountChangedError();
    }

    if (mutationAccount.tokens.has(key)) {
      throw new Error("This social action is already in progress.");
    }

    const mutationToken = Symbol(key);
    mutationAccount.tokens.set(key, mutationToken);
    this.#publish();

    try {
      try {
        const result = await mutation();

        if (this.#account !== mutationAccount || !isAccountCurrent()) {
          throw new SocialMutationAccountChangedError();
        }

        return result;
      } catch (error) {
        if (this.#account !== mutationAccount || !isAccountCurrent()) {
          throw new SocialMutationAccountChangedError();
        }

        throw error;
      }
    } finally {
      if (mutationAccount.tokens.get(key) === mutationToken) {
        mutationAccount.tokens.delete(key);
      }

      if (this.#account === mutationAccount) {
        this.#publish();
      }
    }
  }

  #publish() {
    this.#snapshot = {
      accountEpoch: this.#account.accountEpoch,
      pendingKeys: new Set(this.#account.tokens.keys()),
      userId: this.#account.userId,
    };

    for (const listener of this.#listeners) {
      listener();
    }
  }
}
