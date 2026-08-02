# ADR 0003: Persistent Parties And Friends

Status: Accepted for implementation
Date: 2026-08-02

## Context

Private multiplayer currently treats each room as one game session. A signed-in
host chooses a multiplayer game in the launcher, creates a room for that game,
shares `/?room=<code>`, claims a game-specific seat, waits for a guest to join as
an observer and claim the other seat, and then starts the game. Playing a
different game with the same person repeats room creation, invitation, joining,
and seat selection.

Invite links are a useful guest fallback, but they are too much ceremony for
people who play together repeatedly. The application already has signed-in
accounts with unique normalized display names, a reusable private-room shell,
game-agnostic realtime envelopes, and client/server adapter registries. Those
boundaries can support a durable social relationship and a party that survives
several game matches without changing the authoritative server model.

The current protocol also uses participant ids in client messages. Social and
party permissions make participant identity security-sensitive: public ids and
client-submitted user ids must not become account authentication or command
authority.

ADR 0001 remains authoritative for private, server-authored multiplayer,
volatile realtime state, sidecar ownership, observer read-only behavior, and
separation from solo replay and leaderboard paths. This ADR extends its room
lifecycle and signed-in participant decisions. It does not introduce public
matchmaking.

## Decision

### Party And Match Lifetimes

A private room becomes a persistent party containing zero or one current match.
The existing room code and `/?room=<code>` URL remain stable for the party so
bookmarks, browser history, and guest links keep working. User-facing copy should
say `Party`; existing route and internal `room` names may remain where renaming
would add compatibility churn without clarifying a boundary.

Party state owns:

- room code and host ownership;
- participants and their signed-in identity, when authenticated;
- stable player-slot order and observers;
- join policy and outstanding live membership;
- presence, reconnect grace, and explicit leave/close behavior;
- the current match identity, if a match is selected.

Match state owns:

- a unique match id or generation;
- selected game id and validated parameters;
- game-specific seats derived from the selected server adapter;
- lobby, starting, running, paused, and finished lifecycle;
- the game adapter runtime, authoritative snapshots, and terminal summary.

Changing games or rematching creates a new match generation inside the same
party. It destroys the previous game runtime, obtains the next adapter's seats,
maps stable party player slots onto those seats, and retains participants and the
party URL. Every gameplay input identifies the current match generation, and the
server rejects stale input from an earlier game or rematch.

The host controls initial game selection, parameters, start, pause/resume,
rematch, and game changes in the first rollout. A game change during an active
match requires an explicit finish/abandon confirmation; the ordinary path is
Rematch or Choose another game from the terminal party controls.

### Players And Observers

Party membership and game participation are separate. A participant can be the
host while watching, and an ordinary signed-in or guest participant can occupy a
player slot. The first rollout keeps two stable player slots because every
registered multiplayer adapter currently requires two seats.

The host receives Player 1 by default. A play invitation or guest Join game
action atomically adds the participant and assigns Player 2 when it is available
before a match starts. Manual observer-then-seat claiming is not the primary
flow. Watch remains available as an explicit action and as the fallback when
player slots are full or a match is already running.

Observers:

- do not consume player slots;
- receive authoritative snapshots but cannot submit gameplay input or host
  commands;
- remain in the party across rematches and game changes;
- may request Join next match but are never injected into a running match;
- enter a FIFO next-match queue when they opt in;
- fill an available player slot between matches;
- are capped by a configurable party observer limit to bound snapshot fanout.

The host may choose Watch instead before a match so two other participants can
play. Party UI separates Players, Watching, and Next match instead of exposing
raw adapter seats as the normal interaction.

### Friends And Discovery

Friends are a signed-in-only capability. Guest links remain supported for
people without accounts.

User discovery uses an exact normalized display-name lookup and returns at most
one minimal public identity. The application does not expose fuzzy search, a
public user directory, profiles, activity feeds, or chat in the first rollout.

Friendship uses an explicit request and acceptance workflow. Users can decline
or cancel requests, remove friends, and block other users. Blocks are directed
and suppress discovery results, pending requests, friendships, party
invitations, and invitation acceptance in both directions.

Durable SQLite state stores friend requests, accepted canonical friendship
pairs, directed blocks, and short-lived party invitations. Party invitations
reference volatile party codes without a database foreign key. Accepting an
invitation must revalidate that the party still exists before joining.

### Availability And Invitation Eligibility

A signed-in user has one effective social availability state:

- `available`: active in the launcher or another invite-safe surface;
- `busy`: actively playing a solo game or replay;
- `in-party`: hosting, playing, waiting, or observing in a party;
- `offline`: no live presence lease;
- `unknown`: availability has not resolved yet.

Only `available` friends can receive a party invitation. Busy, offline, unknown,
same-party, and other-party friends have a disabled invite action with clear
status copy. The server rechecks eligibility atomically when creating an
invitation and returns a conflict if availability changed after the UI loaded.

The app does not deliver an invitation to someone already playing. There is no
Join now, After this match, or cross-party transfer flow. If a pending recipient
becomes busy, goes offline, or joins a party before accepting, the invitation
remains pending but cannot be accepted. It becomes actionable again when the
recipient is `available`, provided its bounded TTL has not expired. Volatile
availability observations do not rewrite durable invitation state.

Availability is volatile lease state, not high-frequency SQLite history. A
visible browser client refreshes a short-lived per-client lease through an
authenticated Next endpoint. Effective state aggregates multiple browser tabs
with the priority `in-party`, then `busy`, then `available`. Party membership is
authoritative in the sidecar. Expired leases become offline so crashes cannot
leave users permanently busy.

The first implementation does not reveal the specific game a friend is playing.
It exposes only the minimum status needed to explain invitation availability.

### Invitations And Admission

A host may invite an available friend from the launcher friend-first flow or the
party UI. An invitation targets the party, not its current match, and expires
after a bounded interval or when the party closes or disappears.

Invitation creation verifies authenticated host ownership, accepted friendship,
block state, recipient availability, active-party membership, party capacity,
and duplicate active invitations. It validates the durable relationship before
consulting private party authority, revalidates the relationship after that
call, and persists the invitation only after both checks and the authority check
succeed.

Invitation acceptance verifies the signed-in recipient again and atomically
claims one invitation for that recipient before calling volatile party
authority. The short claim prevents concurrent accepts from admitting the same
account to different parties. The server then admits the account through a
trusted Next-to-sidecar command and marks the invitation accepted only after
admission succeeds. Only the live claim token may finalize acceptance. A newly
admitted membership is compensated before the claim is released if durable
finalization fails; if compensation cannot be confirmed, the claim remains
until its lease expires. Releasing an ordinary failed attempt restores the
invitation's original expiry and resolves it immediately if that deadline has
passed; only an unobserved crash leaves the recovery extension in force.
Accepted-response retries use a membership-only
reacquisition command and cannot create membership after the account has left.

A recipient who joins before a match starts receives the open player slot for a
play invitation. A recipient who joins a party with a running match watches and
may queue for the next match. Invite to watch always creates an observer.

The party defaults to invite-only. A host may enable Friends may join for the
current party; that policy still requires the friend to be available and the
server to authenticate the join. Copy guest link remains a secondary fallback.

### Participant Authority And Reconnect

Participant ids are public identifiers and are not capabilities. Creating or
joining a party returns a separate opaque room-scoped capability that is never
published in snapshots. The sidecar maps that secret to a participant and binds
the WebSocket connection after bootstrap/resume.

The gateway derives gameplay and non-host room command identity from the bound
socket. It rejects unbound commands and mismatched identity fields. Public
WebSocket messages cannot assert signed-in user ids. Host-only commands and
authenticated friend admission continue through Next HTTP, which derives the
account from the HTTP-only session cookie and uses the internal room service.

Signed-in users can reacquire party membership through authenticated HTTP after
a reload. Guest capabilities live in session storage so a reload of the same tab
can resume without putting the secret in the URL or durable application data.

Temporary disconnects reserve membership and player order for a bounded grace
period. Explicit leave removes the participant immediately. If the host remains
absent after the grace period, ownership transfers to the earliest joined,
connected, signed-in member; guests cannot become host. If no eligible member
exists, the party closes.

### Notification Delivery

The first social rollout uses low-frequency authenticated overview requests:
load immediately after sign-in, refresh after mutations and window focus, and
poll only while the document is visible. This traffic is separate from
authoritative room snapshots and does not reintroduce browser polling for live
game state.

If future scale or latency requires realtime social delivery, it should use an
authenticated notification channel. Account authority must not be added to the
public room WebSocket merely to deliver friend badges.

### Persistence And Results

Friendships, blocks, invitation records, rate-limit counters, and short
recipient-wide invitation-acceptance claims are durable. Acceptance claims use
a 30-second lease and extend the selected invitation through a two-minute
recovery grace while retaining its original expiry for normal failure release.
Terminal nonaccepted invitation history is globally bounded,
and only the newest accepted invitation per recipient is retained as a
lost-response reacquisition index. Parties, participant capabilities, presence
leases, matches, game runtime, and observer queues remain volatile. A sidecar
restart abandons them consistently with ADR 0001.

Changing games does not write multiplayer state into solo replays, sessions, or
leaderboards. Any later multiplayer history remains a compact server-derived
summary rather than a durable per-event log.

## Compatibility And Rollout

Implementation should be staged behind coordinated server and client feature
gates until the party snapshot, protocol, and UI land together.

- Existing `/?room=<code>` links continue to resolve.
- Guest display-name joins and watching remain available.
- Existing multiplayer adapters retain server authority and game-specific rules.
- Solo game, replay, profile, and leaderboard behavior remains unchanged.
- Old clients must fail clearly on unsupported party protocol versions rather
  than sending commands without a match generation or participant capability.

The implemented capability-aware protocol is version 6. The internal
room-service collection advertises the version, a versioned mutation path, and
the account-authority capabilities used by this flow, including
`membershipOnlyReacquisition: true`. Every mutating internal POST uses that path
and carries the version in a required header. The app preflights before posting
while the sidecar validates the path and header before parsing the mutation. An
old sidecar, including a v6 sidecar without atomic membership-only
reacquisition, fails closed before admission. Browser-to-app mutations use
parallel versioned public paths while legacy POST routes return 426. WebSocket
hello/resume and bootstrap messages negotiate the same version before the
gateway reads room state or activates a socket; a mismatched bootstrap is a
terminal connection failure rather than a reconnect loop.

The rollout order is: participant authority hardening; party/match separation;
automatic player and observer flows; social persistence and APIs; friends UI;
availability-gated invitations; reconnect and ownership polish; full browser and
sidecar verification.

## Consequences

Players can invite a friend once and play several games without recreating a
room, sharing another link, re-entering a name, or manually claiming seats.
Observers remain supported without complicating the normal two-player path.

The application gains durable social data and privacy/abuse responsibilities,
including exact discovery, blocks, request limits, minimal disclosure, and
authenticated mutations. It also gains a volatile presence registry and an
explicit bridge between durable invitations and volatile parties.

Separating party and match lifetimes is a significant protocol and state-model
change, but it preserves the existing game-adapter and server-authority
boundaries. Match generations and socket-bound participant capabilities make
cross-game reuse safer than extending the current client-submitted participant
id contract.

Disallowing invitations to busy or already-partied friends sacrifices deferred
or cross-party invitations. It provides a clearer initial product, prevents
gameplay interruptions, and avoids partially completed party transfers. A
previously delivered invitation may wait through temporary unavailability, but
it never interrupts play or transfers membership and still expires on its
original bounded timeline unless an acceptance claim is actively recovering.

### Known Acceptance Recovery Limit

Acceptance claims serialize ordinary concurrent decisions, but their leases do
not form a distributed transaction with volatile party authority. If an
admission response takes longer than the claim lease, a retry may reacquire that
same provisional membership. If the invitation is then canceled, revoked, or
otherwise resolved before either request finalizes, exact compensation can no
longer prove that removing the membership is safe because the retry minted a
second capability. The account may remain in a capability-less volatile party
membership until the party closes, expires, or the sidecar restarts.

This rare recovery window requires authority latency longer than the claim
lease, a same-recipient retry, and a second terminal or persistence race. It does
not disclose a capability or grant party control. A future protocol revision
should carry invitation and acceptance-generation identifiers into provisional
admission and add explicit commit/abort commands so the sidecar can fence older
attempts and remove only the newest uncommitted membership.

## Rejected Alternatives

### Friend Invites That Create A New Game Room

This would remove link copying but preserve the most frustrating behavior:
membership, seats, and invitations would still repeat for every game.

### Public Matchmaking Or User Directory

The desired use case is repeated private play with known people. Public
discovery adds moderation, privacy, queueing, and abuse surface without solving
that primary flow.

### Client-Submitted User Or Participant Identity

Public ids are visible in snapshots and cannot establish account or command
authority. Social admission requires authenticated server-derived identity and
socket-bound capabilities.

### Durable Realtime Parties And Presence In SQLite

High-frequency room, input, tick, and presence writes would conflict with the
existing lightweight persistence boundary. Durable social relationships can
refer to volatile parties while acceptance revalidates live state.

### Invitations While Busy Or In Another Party

Deferred and cross-party flows require interruption policy, membership transfer,
rollback, and host-ownership behavior. Availability gating is smaller, clearer,
and consistent with non-interrupting gameplay.
