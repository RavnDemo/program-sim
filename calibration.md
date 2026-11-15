## Calibration — Ravn with bramble-agent vs the team

Reports judged: **7** of 23 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 83% (5/6) |
| Agent's proposal, valid vs not | 100% (6/6) |
| Classify: security-relevant = team found it valid | 100% (7/7) |
| Ravn's Route (escalate = valid, close = not) | 83% (5/6) |
| Severity on resolved reports | 50% (1/2) |

### Mismatches (2)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
