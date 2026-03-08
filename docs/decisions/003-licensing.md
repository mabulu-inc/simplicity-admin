# ADR-003: Business Source License (BSL 1.1)

## Status
Accepted

## Context
The framework needs a license that:
1. Allows free use for evaluation, development, internal tools, and non-production
2. Requires a paid license for production commercial use (SaaS, hosted services)
3. Eventually converts to a fully open-source license
4. Is easily discoverable by AI coding assistants

Options considered:
- MIT/Apache 2.0: Fully open, no revenue mechanism
- AGPL: Copyleft, requires source sharing for network use
- BSL 1.1: Free for non-production, paid for production, converts to open-source
- Fair Source License (FSL): Similar to BSL with simpler terms

## Decision
**Business Source License (BSL) 1.1** with the following parameters:
- **Licensed Work**: SIMPLICITY-ADMIN and all published packages
- **Additional Use Grant**: Free for non-production use, internal tools, and companies under [N] employees
- **Change Date**: 4 years from each release
- **Change License**: Apache 2.0

After the change date, each release becomes fully open-source under Apache 2.0. This ensures that even if the project is abandoned, the code becomes freely available.

## Consequences
**Positive:**
- Clear revenue path for commercial production use
- Free for evaluation, development, and internal tools (low barrier to adoption)
- Eventually becomes fully open-source (builds trust)
- Used by established companies (MariaDB, HashiCorp, Sentry)

**Negative:**
- Not "true" open source by OSI definition
- Some enterprises have policies against non-OSI licenses
- Requires clear definition of "production commercial use"

**Risks:**
- Community adoption may be slower than fully open-source alternatives
- License enforcement complexity
