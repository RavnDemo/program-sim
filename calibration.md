## Calibration — Ravn with bramble-agent vs the team

Reports judged: **12** of 28 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 83% (10/12) |
| Agent's proposal, valid vs not | 92% (11/12) |
| Classify: security-relevant = team found it valid | 92% (11/12) |
| Ravn's Route (escalate = valid, close = not) | 83% (10/12) |
| Severity on resolved reports | 50% (3/6) |

### Mismatches (4)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
| BRM-027 | [#4206205](https://hackerone.com/reports/4206205) | accept (low) | reject | ESCALATE | Open redirect via /redirect?to= using a stale allowlisted address |
