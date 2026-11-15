## Calibration — Ravn with bramble-agent vs the team

Reports judged: **9** of 25 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 88% (7/8) |
| Agent's proposal, valid vs not | 100% (8/8) |
| Classify: security-relevant = team found it valid | 100% (9/9) |
| Ravn's Route (escalate = valid, close = not) | 75% (6/8) |
| Severity on resolved reports | 33% (1/3) |

### Mismatches (3)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
