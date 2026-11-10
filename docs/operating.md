# Operating

## What exists (2026-11-10)

| thing | where |
| --- | --- |
| HackerOne org (sandbox) | `bramble_market_demo` (id 79865) |
| Program | `bramble_market_h1b` (id 119819), Bounty edition, sandboxed, not launched |
| Scope | `https://bramble.example` (URL), `https://bramble.example/api` (API), `https://github.com/RavnDemo/bramble` (source) |
| Webhook | *Ravn*, all events → Ravn's `bramble-market` org |
| Ravn org | `bramble-market` (apps.ravnsecurity.io/app/o/bramble-market), program connected read-only, write-back off |
| 1Password | vault **RavnDemo**: one login per account (password, TOTP, backup codes, API token), the two org API tokens, the Ravn webhook secret |

## Accounts

All addresses are `david+h1-<who>@davidwelch.co`. Every HackerOne account has 2FA; the TOTP seed and backup codes
are on its 1Password item, so `op item get "H1 ravndemo_<who>" --otp` gives a code.

| who | HackerOne | role | secret |
| --- | --- | --- | --- |
| nightjar | `ravndemo_nightjar` | hacker | `H1_NIGHTJAR_TOKEN` |
| quillfeather | `ravndemo_quillfeather` | hacker | `H1_QUILLFEATHER_TOKEN` |
| slopstorm | `ravndemo_slopstorm` | hacker | `H1_SLOPSTORM_TOKEN` |
| triager | `ravndemo_triage` | org admin (created the org) | — |
| team API | token `bramble-triage`, group *Program admins* | Customer API, works the program | `H1_TEAM_TOKEN` |
| Ravn | token `ravn-bramble`, group *Program viewers* | what Ravn reads with | (in Ravn) |

Hacker tokens: hackerone.com/settings/api_token/edit (one per account; regenerating revokes the old one).

Repo variables: `SIM_ENABLED` (scheduled runs on — **true**), `SIM_LIVE` (scheduled runs act on HackerOne — **false**,
so the hourly run is a dry run against `dry-run.json` on the `ledger` branch).

## Going live

1. **Invite the hackers.** HackerOne refuses invitations until the program has a logo (done) **and a payment
   method** (not done — a card on file is charged for every reward paid). Then invite `ravndemo_nightjar`,
   `ravndemo_quillfeather`, `ravndemo_slopstorm` (program → Hacker management → Invites) and accept each invite
   as that hacker.
2. `check` (live) — every token says `ok` and every persona says `program: visible`.
3. Reset the dry-run ledger if you like (delete `dry-run.json` on `ledger`), then `file BRM-001` (live) — one real
   report end to end; look at it in HackerOne and in Ravn.
4. `backfill 40` (live), then set `SIM_LIVE=true`. Backfill files every 2h with timelines at 10% speed, then steady
   state takes over (6 a week).
5. Bounties stay off (`config/cadence.yml` → `bounties.enabled`) until you've decided about the card.

## Known limits

1. **Hackers can't comment through the API.** HackerOne's Hacker API has no comment endpoint, so `by: reporter`
   comment steps are recorded as *skipped* in the ledger. Needs-more-info rounds still happen (the team's side is
   real); the reporter's reply isn't posted. Options if it matters: HackerOne GraphQL with the hacker's token, or a
   browser step.
2. **No backdating.** HackerOne stamps everything when it happens. "History" is built by the backfill running fast.
3. **Bounties in a sandbox** may be refused (403). A failing step retries three times, then parks; `retry <id>`
   un-parks it after a fix. Set `bounty` to 0 in the index if the sandbox can't pay.
4. **Reputation:** sandbox outcomes may move the demo hackers' reputation. That's fine; they're demo accounts.
