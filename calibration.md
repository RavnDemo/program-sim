## Calibration — Ravn with bramble-agent vs the team

Reports judged: **48** of 65 filed.

| measure | match |
| --- | --- |
| Agent's proposal = team's decision (accept / reject / duplicate) | 85% (41/48) |
| Agent's proposal, valid vs not | 92% (44/48) |
| Classify: security-relevant = team found it valid | 96% (46/48) |
| Ravn's Route (escalate = valid, close = not) | 90% (43/48) |
| Severity on resolved reports | 42% (11/26) |

### Mismatches (11)

| scenario | report | team | agent | route | title |
| --- | --- | --- | --- | --- | --- |
| BRM-017 | [#4203407](https://hackerone.com/reports/4203407) | reject | reject | ESCALATE | Logged into a Bramble Market account using a password found in a leake |
| BRM-021 | [#4204575](https://hackerone.com/reports/4204575) | accept (high) | duplicate | ESCALATE | Support team's real credentials recoverable from a committed KeePass b |
| BRM-023 | [#4204865](https://hackerone.com/reports/4204865) | reject | reject | ESCALATE | Known upstream dependency advisory inherited from the base project |
| BRM-027 | [#4206205](https://hackerone.com/reports/4206205) | accept (low) | reject | ESCALATE | Open redirect via /redirect?to= using a stale allowlisted address |
| BRM-031 | [#4207230](https://hackerone.com/reports/4207230) | accept (high) | needs-info | ESCALATE | 2FA TOTP secret stored in plaintext and retrievable, enabling 2FA take |
| BRM-034 | [#4209312](https://hackerone.com/reports/4209312) | reject | reject | ESCALATE | CRITICAL: User Password Exposed in Publicly Posted Media (MC SafeSearc |
| BRM-037 | [#4210181](https://hackerone.com/reports/4210181) | reject | accept (low) | ESCALATE | CRITICAL: User Registration Accepts Empty Email and Password |
| BRM-038 | [#4210408](https://hackerone.com/reports/4210408) | accept (medium) | needs-info | ESCALATE | No rate limiting on the forgot-password security-question answer enabl |
| BRM-049 | [#4215792](https://hackerone.com/reports/4215792) | reject | reject | ESCALATE | CRITICAL: Insecure cryptography - weak hashing and encoding exposes al |
| BRM-054 | [#4219266](https://hackerone.com/reports/4219266) | duplicate | accept (medium) | ESCALATE | Any user can edit another customer's product review (no ownership chec |
| BRM-055 | [#4219267](https://hackerone.com/reports/4219267) | accept (medium) | duplicate | ESCALATE | GDPR-erased accounts remain loginable: soft-delete isn't enforced at a |
