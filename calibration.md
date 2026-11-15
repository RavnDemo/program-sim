## Calibration — Ravn with bramble-agent vs the team

Reports judged: **8** of 24 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 86% (6/7) |
| Agent's proposal, valid vs not | 100% (7/7) |
| Classify: security-relevant = team found it valid | 100% (8/8) |
| Ravn's Route (escalate = valid, close = not) | 71% (5/7) |
| Severity on resolved reports | 50% (1/2) |

### Mismatches (3)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
