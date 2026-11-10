# program-sim

Keeps the **Bramble Market** HackerOne sandbox program alive, deterministically: hackers file reports, the
security team triages, asks for more info, closes duplicates, resolves and pays. No LLM runs here — every
report and every team action is written down in [`corpus/`](corpus), and the schedule is pure arithmetic over a
ledger.

- Target app: [RavnDemo/bramble](https://github.com/RavnDemo/bramble), OWASP Juice Shop rebranded as Bramble Market.
- Program: a HackerOne **sandbox** (`config/program.yml`). Nothing here is a real company or a real payout.
- What it's for: a program that looks and behaves like a real team's, so Ravn can be shown — and calibrated —
  against outcomes we know. `corpus/index.yml` is the ground truth: what the team decides for every report.

## How it runs

| | |
| --- | --- |
| **Schedule** | `sim` workflow, hourly. Does nothing until repo variable `SIM_ENABLED=true`; acts on HackerOne only with `SIM_LIVE=true`. |
| **By hand** | Actions → **sim** → *Run workflow*: `tick`, `status`, `check`, `file <id>`, `step <id>`, `backfill <n>`, `retry <id>`. Tick *live* to act on HackerOne. |
| **State** | `ledger.json` on the `ledger` branch (live) and `dry-run.json` (dry runs). Which scenario became which report, which step is next. |
| **Cadence** | `config/cadence.yml`: arrivals per week, team speed, backfill size and speed. |
| **Who** | `config/personas.yml`: three hackers (`nightjar`, `quillfeather`, `slopstorm`) and the triager. Tokens are repo secrets. |

Locally (Node ≥ 24):

```sh
npm ci
node src/cli.ts validate               # corpus rules (docs/corpus.md)
node src/cli.ts simulate 30d --backfill --verbose   # what the next month would look like, dry
node src/cli.ts tick                   # one dry-run tick against .ledger/dry-run.json
```

See [docs/corpus.md](docs/corpus.md) for the corpus format and [docs/operating.md](docs/operating.md) for setup,
secrets and known limits.
