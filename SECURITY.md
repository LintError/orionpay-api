# Security Policy

## Supported Versions

The latest version of the `main` branch is actively maintained and supported for security updates.

| Version | Supported |
| ------- | --------- |
| main    | :white_check_mark: |
| < 1.0.0 | :x: |

---

## Automated Security Scans & CI Enforcement

To protect users and maintain high assurance in the OrionPay payment infrastructure, several automated security scanning systems run continuously in our CI/CD pipelines:

### 1. CodeQL Static Application Security Testing (SAST)
- **Languages**: JavaScript / TypeScript (NestJS API) and Python (AI Engine).
- **Triggers**: Every push to `main`, every pull request targeting `main`, and a scheduled weekly scan (`cron: '0 3 * * 1'`).
- **Queries**: Security-extended rulesets detecting injection, cryptographic weaknesses, and insecure defaults.

### 2. Dependency Review & Vulnerability Auditing
- **Pull Request Gating**: `dependency-review-action` runs on all pull requests, blocking newly introduced dependencies with high or critical CVEs.
- **Node.js**: `npm audit --audit-level=high` runs in CI and fails if any high or critical vulnerabilities are introduced.
- **Python**: `pip-audit` runs against `ai/requirements.txt` to identify vulnerable dependencies in the AI service.

### 3. Container Image Scanning
- Docker images for both the NestJS API (`docker/api.Dockerfile`) and Python AI engine (`docker/ai.Dockerfile`) are built and scanned with **Trivy** in CI for OS and runtime vulnerabilities.

### 4. Secret Scanning & Push Protection
- Secret scanning and push protection prevent accidental disclosure of API keys, Stellar private keys, and JWT secrets.
- **Maintainer Note**: Repository-level GitHub Secret Scanning and Push Protection must be enabled in the repository settings:
  `Settings -> Code security and analysis -> Secret scanning -> Push protection (Enabled)`.

---

## Reporting a Vulnerability

Please do not open a public issue for security vulnerabilities.

If you believe you have discovered a security issue:
1. Report it privately through GitHub's **Private Vulnerability Reporting** feature if enabled.
2. Alternatively, reach out directly to the maintainers through the designated security channel.

### Report Contents
When reporting an issue, please provide:
- A clear description of the potential invariant violation or security issue.
- Minimal reproducible steps or a defensive test scenario.
- Component affected (NestJS API, AI Engine, or Smart Contract interactions).
- Expected vs actual behavior.

We review all security reports promptly and coordinate fixes in accordance with responsible disclosure practices.
