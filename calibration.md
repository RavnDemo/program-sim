## Calibration — Ravn with bramble-agent vs the team

Reports judged: **21** of 37 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 85% (17/20) |
| Agent's proposal, valid vs not | 90% (18/20) |
| Classify: security-relevant = team found it valid | 90% (19/21) |
| Ravn's Route (escalate = valid, close = not) | 85% (17/20) |
| Severity on resolved reports | 33% (4/12) |

### Mismatches (6)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
| BRM-027 | [#4206205](https://hackerone.com/reports/4206205) | accept (low) | reject | ESCALATE | Open redirect via /redirect?to= using a stale allowlisted address |
| BRM-031 | [#4207230](https://hackerone.com/reports/4207230) | accept (high) | needs-info | ESCALATE | 2FA TOTP secret stored in plaintext and retrievable, enabling 2FA take |
| BRM-034 | [#4209312](https://hackerone.com/reports/4209312) | reject | reject | ESCALATE | CRITICAL: User Password Exposed in Publicly Posted Media (MC SafeSearc |
