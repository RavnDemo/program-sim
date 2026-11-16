## Calibration — Ravn with bramble-agent vs the team

Reports judged: **13** of 29 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 85% (11/13) |
| Agent's proposal, valid vs not | 92% (12/13) |
| Classify: security-relevant = team found it valid | 92% (12/13) |
| Ravn's Route (escalate = valid, close = not) | 85% (11/13) |
| Severity on resolved reports | 43% (3/7) |

### Mismatches (4)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
| BRM-027 | [#4206205](https://hackerone.com/reports/4206205) | accept (low) | reject | ESCALATE | Open redirect via /redirect?to= using a stale allowlisted address |
