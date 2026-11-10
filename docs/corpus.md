# The corpus

Two layers, both checked in, both deterministic at run time:

1. **`corpus/index.yml` — the truth.** One row per scenario: who files it, against which asset and weakness,
   what severity they claim, and what the team decides (`outcome`, final `severity`, `bounty`, `duplicate_of`).
   Generated once by `tools/build-index.rb` from Juice Shop's challenge list plus hand-made calls, then edited by hand.
   Ravn's decisioning is calibrated against these outcomes: a mismatch is a Ravn finding, not a corpus bug.
2. **`corpus/scenarios/<id>.yml` — the prose and the script.** What the hacker writes, and the timeline of what
   the team (and the reporter) do afterwards.

Order of filing is the order of `index.yml`. A duplicate always comes after its original.

## Scenario file

```yaml
id: BRM-042                     # must match the file name and an index row
title: SQL injection in login lets anyone sign in as the administrator
vulnerability_information: |    # markdown; what the hacker writes. Steps to reproduce, PoC, observed result.
  ...
impact: |                       # markdown; the hacker's impact statement
  ...
timeline:                       # executed in order; `after` is the delay since the previous step (or since filing)
  - after: 2h
    by: team                    # team | reporter
    do: comment                 # comment | state | severity | bounty
    internal: true              # team comments only; default false
    message: Reproduced on prod. Login form, email field. Escalating.
  - after: 30m
    by: team
    do: state
    state: triaged              # new | triaged | needs-more-info | resolved | informative | not-applicable | duplicate | spam
    message: Thanks — confirmed and triaged. We'll keep you posted.
  - after: 10m
    by: team
    do: severity
    rating: critical            # none | low | medium | high | critical
  - after: 6d
    by: team
    do: state
    state: resolved
    message: Fixed by parameterising the login query. Thanks again.
  - after: 1h
    by: team
    do: bounty
    amount: 3000                # must equal the index row's bounty
    message: Thanks for a clear, minimal report.
```

Fields that come **from the index**, not the file: `reporter`, `asset`, `weakness`, `claimed_severity` (sent as the
report's severity rating at filing), and the truth fields. Don't repeat them in the scenario file.

### Placeholders

Rendered at run time from `config/program.yml` and the ledger:

| placeholder | becomes |
| --- | --- |
| `{{base_url}}` | the storefront's base URL, e.g. `https://bramble.example` |
| `{{source_url}}` | the source repo, `https://github.com/RavnDemo/bramble` |
| `{{program}}` | the HackerOne program handle |
| `{{report:BRM-013}}` | the HackerOne report number of another scenario, e.g. `#2841903` (use in duplicate closes) |

### Rules the validator enforces

1. The last `state` step equals the index `outcome`.
2. `outcome: duplicate` ⇒ that last state step's message references `{{report:<duplicate_of>}}`.
3. Bounty steps sum to the index `bounty` (0 ⇒ no bounty step). Bounties only after `resolved`.
4. `needs-more-info` is followed by a `reporter` comment before the next team state change, unless the outcome closes
   it for no reply (then the team's close message says so).
5. Durations are `<n>m`, `<n>h` or `<n>d`.
6. No real people, companies or domains besides Bramble Market's own placeholders. Juice Shop's in-app users
   (admin, jim, bender, …) are fine: they're fictional accounts inside the app.

## Personas

| key | who | voice |
| --- | --- | --- |
| `nightjar` | strong regular | Terse, exact. Minimal PoC (curl / raw HTTP), root cause named, severity argued with CVSS. Rarely a duplicate. |
| `quillfeather` | competent, mid-signal | Friendly, a bit long. Screenshots described in words, sometimes misses the root cause, OSINT-leaning, files duplicates. |
| `slopstorm` | noisy | Templated, AI-sounding, "Dear Security Team", claims critical every time, generic remediation lists, asks about bounty. Occasionally right (then usually a duplicate). |

Team (`by: team`): the Bramble Market security team, worked by one triager. Polite, brief, consistent. Internal
notes are short and practical ("Repro'd. Same root cause as {{report:BRM-013}}.").
