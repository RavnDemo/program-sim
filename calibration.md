## Calibration — Ravn with bramble-agent vs the team

Reports judged: **14** of 30 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 86% (12/14) |
| Agent's proposal, valid vs not | 93% (13/14) |
| Classify: security-relevant = team found it valid | 93% (13/14) |
| Ravn's Route (escalate = valid, close = not) | 86% (12/14) |
| Severity on resolved reports | 38% (3/8) |

### Mismatches (4)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
| BRM-027 | [#4206205](https://hackerone.com/reports/4206205) | accept (low) | reject | ESCALATE | Open redirect via /redirect?to= using a stale allowlisted address |
