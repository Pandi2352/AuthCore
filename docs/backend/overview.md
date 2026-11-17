# AuthCore — Project Overview

## What AuthCore is

AuthCore is a production-grade, enterprise-ready authentication platform that can be reused across projects. The goal is to make AuthCore a reusable identity and access management (IAM) foundation, not simply a collection of 200 endpoints.

## Final project scope

| Item | Count |
| --- | --- |
| Original modules | 20 |
| Additional modules | 8 |
| **Total modules** | **28** |

### Estimated API scope

**150–200+ endpoints** (approximate) if all optional enterprise capabilities are implemented. Some features are background jobs or infrastructure rather than APIs.

## Build plan: three levels

| Level | Scope | Goal |
| --- | --- | --- |
| Level 1 | Modules 1–20 | Complete reusable authentication |
| Level 2 | Modules 21–24 | Advanced security and identity |
| Level 3 | Modules 25–28 | Enterprise IAM and compliance |

## Level 1 — Original modules (1–20) · MVP

Numbered in build order (Module N = Sprint N).

1. Common Infrastructure
2. Identity & User Management
3. Authentication
4. Session & Device Management
5. Email & Notification
6. Email Verification
7. Password Management
8. Role-Based Access Control (RBAC)
9. Permission Management
10. Security & Protection
11. Audit Logs & Login History
12. Admin Management — *MVP release candidate*
13. Multi-Factor Authentication (MFA)
14. OAuth & Social Login
15. Passwordless Authentication
16. Multi-Tenancy & Organization
17. API Key Management
18. Configuration & Policy Management
19. Testing & Quality
20. DevOps & Deployment — *Level 1 production release*

Full checklist, implementation phases and architectural principles: [level-1-modules.md](./level-1-modules.md)

## Level 2 — Additional modules (21–24)

These are added on top of the original 20 modules rather than rebuilding them:

21. Advanced Token & Cryptography Management
22. Account Recovery & Identity Protection
23. Adaptive & Risk-Based Authentication
24. Enterprise SSO & Identity Federation

Full checklist: [level-2-modules.md](./level-2-modules.md)

## Level 3 — Additional modules (25–28)

25. Support & Identity Administration
26. Compliance & Privacy Management
27. Enterprise User Provisioning
28. Security Testing & Threat Management

Full checklist: [level-3-modules.md](./level-3-modules.md)

## Guiding principles

- Don't implement all 28 modules just to increase the API count.
- Learn the security concepts behind each feature.
- Some capabilities, especially **SAML, SCIM, OAuth and cryptographic key management**, should use well-maintained standards and libraries rather than custom protocols.
- The additions align with OWASP authentication, session management and OAuth security guidance (OWASP Cheat Sheet Series).

## Related documents

- [level-1-modules.md](./level-1-modules.md) — Modules 1–20 (MVP)
- [level-2-modules.md](./level-2-modules.md) — Modules 21–24
- [level-3-modules.md](./level-3-modules.md) — Modules 25–28
- [project-setup-checklist.md](./project-setup-checklist.md) — production-ready setup before feature code
- [techstack.md](./techstack.md) — technology stack and project setup
