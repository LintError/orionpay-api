# Contributing to OrionPay

Thank you for considering contributing to OrionPay! This document outlines the process and guidelines.

## Getting Started

1. **Fork and clone** the repository.
2. **Install dependencies:**
   ```bash
   npm install
   cd ai && pip install -r requirements.txt
   ```
3. **Set up your environment** — copy `.env.example` to `.env` and fill in the values.
4. **Start the stack locally:**
   ```bash
   docker compose up
   ```
   Or run the API and DB separately if you prefer.

## Development Workflow

- **Branch from `main`** for every change. Name branches descriptively: `feat/stellar-anchors`, `fix/balance-sync`, `docs/api-examples`.
- **Write tests** for new features and bug fixes. Run `npm test` before committing.
- **Lint and format** before pushing:
  ```bash
  npm run lint
  npm run format
  ```
- **Commit messages** should be clear and imperative: `Add Stellar anchor support`, `Fix wallet balance race condition`.

## Pull Requests

- Keep PRs focused — one feature or fix per PR.
- Describe what changed and why in the PR body.
- Reference any related issues.
- Ensure all tests pass and lint is clean.
- PRs are reviewed by maintainers and may require changes before merging.

## Code Standards

- **Style**: Follow the existing Prettier and ESLint config.
- **TypeScript**: Prefer explicit types over `any` where practical, but the codebase intentionally allows `any` for third-party SDKs and `req.user`.
- **Tests**: Use Jest with mocked dependencies for unit tests; real network calls go in separate integration tests.
- **Blockchain**: Always test on testnet before mainnet.

## Stellar-Specific Contributions

- Stellar testnet is the default (`STELLAR_TESTNET=true`).
- All Stellar changes should work with both Horizon testnet and public.
- Remember that Stellar uses public/secret key pairs, not mnemonic seeds by default.

## Reporting Issues

- Search existing issues first.
- Include clear steps to reproduce, expected vs. actual behavior, and logs or screenshots if relevant.
- For security issues, email the maintainers directly rather than opening a public issue.

## Questions?

Open a discussion or issue, or reach out to the maintainers.
