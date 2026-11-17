# AGENTS.md

Standing rules for every agent (human or AI) working on pull requests in this repository. They apply to the get-dotenv 8 migration branch `feature/gh-6-get-dotenv-8` and its draft pull request, and remain in force until replaced.

## Source of truth

- The approved get-dotenv 8.0 dev plan and its decisions are the source of truth. Do not reverse an owner decision in code.
- Preserve the merged `0.12.0-alpha.0` exclude-keys implementation from pull request #13.
- Do only the approved step. Do not merge, publish, tag, release, or change the package version.

## Step gate

Every implementation step ends with this gate:

1. Review the step diff for SOLID/DRY. Keep behaviour-preserving refactors in separate commits.
2. Land regression tests with the fix. Record the parent SHA where each issue repro fails and the fix SHA where it passes.
3. Mutation-check every changed function and new module by making a representative breaking change and proving a test fails. Trivial tests do not count.
4. Update every README, guide, and TSDoc hit for changed APIs or behaviour in the same step.
5. Run every repository gate with zero warnings or errors: lint, no-emit typecheck, tests with coverage, build, knip, docs, and all package/smoke/verification scripts present in `package.json`.
6. Immediately before every push, run:

   ```bash
   gh pr list --repo karmaniverous/entity-client-dynamodb --head feature/gh-6-get-dotenv-8 --state all --json number,state
   ```

   Stop if the newest pull request is merged or closed. Push immediately after every commit.

7. CI must be green on Ubuntu and Windows for the pushed head before the step is complete.

## Finishing step

The pull request remains draft until all finishing rows are complete:

| Pass                   | What it checks                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Completeness           | Every approved requirement is traced to code, tests, and documentation.                 |
| SOLID/DRY              | Whole-PR design review.                                                                 |
| Test adequacy          | Meaningful coverage and mutation evidence for every touched function or new module.     |
| Docs sync              | README, guides, and TSDoc agree with the implementation; docs build without warnings.   |
| Independent review     | A fresh reviewer checks the complete diff; every finding is fixed or answered.          |
| Gates + CI + mergeable | All local gates and both CI platforms pass on the pushed head, and the PR is mergeable. |

## Lint, types, and tests

- Never use `eslint-disable` in production code and never weaken lint, typecheck, knip, or coverage rules.
- A test may use one narrow `eslint-disable-next-line <rule> -- <reason>` only when unavoidable. List every such line in the pull request body.
- Do not silently skip tests.
- TypeScript remains on major version 6 for this migration.

## Git and GitHub

- Use conventional commits and allow the `add-issue` hook to add the issue prefix from the branch name.
- Use the configured GitHub bot identity for every GitHub write.
- Request review from `karmaniverous`.
- Never force-push.
