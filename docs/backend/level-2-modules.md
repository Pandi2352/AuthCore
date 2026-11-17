# AuthCore — Level 2 Modules

**Level 2: Modules 21–24 — Advanced security and identity**

- Level 1 (Modules 1–20): [level-1-modules.md](./level-1-modules.md)
- Level 3 (Modules 25–28): [level-3-modules.md](./level-3-modules.md)

---

## 21. Advanced Token & Cryptography Management

- [ ] JWT signing algorithm management
- [ ] Asymmetric signing (RS256/ES256)
- [ ] Public/private key management
- [ ] Signing key rotation
- [ ] JWT key ID (kid) management
- [ ] JWKS endpoint
- [ ] Token issuer validation
- [ ] Token audience validation
- [ ] Token scope validation
- [ ] Token version management
- [ ] Token expiration and clock-skew handling
- [ ] Secure random token generation
- [ ] Encryption at rest for sensitive credentials

## 22. Account Recovery & Identity Protection

- [ ] Secure account recovery
- [ ] Lost MFA device recovery
- [ ] Trusted device management
- [ ] Recovery email management
- [ ] Recovery code management
- [ ] Account takeover protection
- [ ] Email change confirmation workflow
- [ ] Account recovery cooldown
- [ ] Recovery attempt monitoring
- [ ] Emergency account lock
- [ ] Account unlock verification

## 23. Adaptive & Risk-Based Authentication

- [ ] Login risk assessment
- [ ] New IP detection
- [ ] New device detection
- [ ] Unusual login location detection
- [ ] Impossible travel detection
- [ ] Suspicious login pattern detection
- [ ] Risk scoring engine
- [ ] Conditional MFA
- [ ] Step-up authentication
- [ ] Automatic session revocation
- [ ] Security alerts

## 24. Enterprise SSO & Identity Federation

- [ ] OpenID Connect (OIDC)
- [ ] SAML 2.0 authentication
- [ ] Single Sign-On (SSO)
- [ ] Identity Provider (IdP) integration
- [ ] Service Provider (SP) integration
- [ ] Multiple identity provider support
- [ ] Enterprise domain-based login
- [ ] Automatic organization discovery
- [ ] SSO configuration per organization
- [ ] SSO session management

---

## Sprint plan (build order)

Starts after Level 1 is in production.

| Sprint | Module | Why this order |
| --- | --- | --- |
| 21 | Advanced Token & Cryptography Management | Asymmetric keys and JWKS are needed by SSO/OIDC (24) |
| 22 | Account Recovery & Identity Protection | Builds on Level 1 MFA, sessions and password management |
| 23 | Adaptive & Risk-Based Authentication | Needs sessions, devices, MFA and audit logs to score risk |
| 24 | Enterprise SSO & Identity Federation | Needs 21 (keys/JWKS) and Level 1 multi-tenancy |

## Notes

- These additions align with OWASP authentication, session management and OAuth security guidance (OWASP Cheat Sheet Series).
- OAuth and cryptographic key management should use well-maintained standards and libraries rather than custom protocols.
