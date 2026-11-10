# Operating

## Accounts

All addresses are `david+<who>@davidwelch.co`. Passwords, TOTP seeds and API tokens live in the 1Password vault
**RavnDemo**; tokens are copied from there into this repo's Actions secrets.

| who | HackerOne | role | secret |
| --- | --- | --- | --- |
| nightjar | `ravndemo_nightjar` | hacker | `H1_NIGHTJAR_TOKEN` |
| quillfeather | `ravndemo_quillfeather` | hacker | `H1_QUILLFEATHER_TOKEN` |
| slopstorm | `ravndemo_slopstorm` | hacker | `H1_SLOPSTORM_TOKEN` |
| triager | `ravndemo_triage` | program member (person) | — |
| team API | API token `bramble-triage` | Customer API, in a group with report + reward permissions | `H1_TEAM_TOKEN` |

Hacker tokens: hackerone.com/settings/api_token/edit (one per account; regenerating revokes the old one).
The team token: Organization settings → API tokens, then add it to a group that can act on reports and award bounties.

Repo variables: `SIM_ENABLED` (scheduled runs on), `SIM_LIVE` (scheduled runs act on HackerOne).

## Going live

1. `check` (live) — every token works, the program's scopes match `config/program.yml`.
2. `file BRM-001` (live) — one real report end to end; look at it in HackerOne and in Ravn.
3. `backfill 40` then set `SIM_ENABLED=true`, `SIM_LIVE=true`. Backfill files every 2h with timelines at 10% speed,
   then steady state takes over (6 a week).

## Known limits

1. **Hackers can't comment through the API.** HackerOne's Hacker API has no comment endpoint, so `by: reporter`
   comment steps are recorded as *skipped* in the ledger. Needs-more-info rounds still happen (the team's side is
   real); the reporter's reply isn't posted. Options if it matters: HackerOne GraphQL with the hacker's token, or a
   browser step.
2. **No backdating.** HackerOne stamps everything when it happens. "History" is built by the backfill running fast.
3. **Bounties in a sandbox** may be refused (403). A failing step retries three times, then parks; `retry <id>`
   un-parks it after a fix. Set `bounty` to 0 in the index if the sandbox can't pay.
4. **Reputation:** sandbox outcomes may move the demo hackers' reputation. That's fine; they're demo accounts.
