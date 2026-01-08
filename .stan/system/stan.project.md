# Project Prompt — entity-client-dynamodb (assistant instructions)

## Scope

This document contains only project-specific assistant instructions that augment the system prompt. All durable product requirements have been moved to:

- .stan/system/stan.requirements.md
- .stan/system/stan.requirements.dynamodb-plugin.md

Keep requirement statements out of this file; use it solely to guide assistant behavior for this repository.

## Documentation formatting policy (HARD RULE — project-level)

- NEVER manually hard-wrap narrative Markdown or plain text content anywhere in this repository.
- Paragraphs MUST be single logical lines; insert blank lines between paragraphs for structure.
- Only preformatted/code blocks (fenced code, CLI excerpts, YAML/JSON examples) may wrap as needed; lists may use one item per line.
- This policy is enforced during review. If prose is manually wrapped, fix it by unwrapping to single-line paragraphs.

## Fence hygiene for embedded code blocks (project-level reminder)

- When editing Markdown docs that contain embedded fenced code blocks, compute the outer fence length per the system “Fence Hygiene” algorithm: choose N = (maximum contiguous backticks found inside the block) + 1, with a minimum of 3.
- Re-scan after composing each block to ensure the outer fence length exceeds any inner run of backticks; adjust N if needed.
- Do not hardcode triple backticks when inner fenced blocks may be present; always compute dynamically.
- These rules apply to all examples and templates included in docs, including multi-fenced samples (e.g., diffs inside code blocks).

## get-dotenv host integration (project-level)

- When authoring get-dotenv plugins in this repo, always use `definePlugin({ ns, ... })` and prefer `plugin.readConfig(cli)` over `cli.getCtx().pluginConfigs[...]` because config is keyed by realized mount path (e.g., `aws/dynamodb`).
- Treat plugin config strings as already interpolated once by the host; avoid re-expanding config-origin strings inside resolvers (expand runtime flags only if desired).

## Typing & API DX policy (HARD RULE — project-level)

- Type casts are a code smell. ALWAYS prefer type inference over type casts.
- Embrace generics to facilitate type inference; design APIs to carry types through naturally.
- The public API MUST support type inference without requiring downstream consumers to pass explicit type parameters.
- Exceptions to these rules are permitted only after a brief design discussion and rationale captured in the dev plan; prefer localized, well-justified exceptions.
- CRITICAL: Downstream DX is NON-NEGOTIABLE. Favor intuitive signatures and inferred types over verbose annotations or casts; changes that degrade downstream inference require rework or a design adjustment before merging.
- Type-only imports MUST use `import type` (or inline `type` specifiers for mixed imports). This is enforced by ESLint.

## TypeDoc

- All exported functions, classes, interfaces, types, and enums MUST have TypeDoc comments.
- Function and method TypeDoc comments MUST document all parameters and the return type.
- All properties of exported interfaces and interface-like types MUST have TypeDoc comments. **CRITICAL: Do NOT convert types to interfaces purely to support TypeDoc property comments; TypeDoc supports property comments on object types.**
- All generic type parameters in exported functions, classes, interfaces, and types MUST be documented in TypeDoc comments.
- Every TypeDoc comment MUST include a summary description.
- TypeDoc comments MUST use proper formatting for code elements (e.g., backticks for code references).
- Special characters in TypeDoc comments (e.g. <, >, {, }) MUST be escaped with a backslash ('\') to avoid rendering issues.

## STAN assistant guide — creation & upkeep policy

This repository SHOULD include a “STAN assistant guide” document at `guides/stan-assistant-guide.md` (or an equivalent single, stable path if your repo uses a different docs layout). This guide exists to let STAN assistants use and integrate the library effectively without consulting external type definition files or other project documentation.

Policy

- Creation (required):
  - If `guides/stan-assistant-guide.md` is missing, create it as part of the first change set where you would otherwise rely on it (e.g., when adding/altering public APIs, adapters, configuration, or key workflows).
  - Prefer creating it in the same turn as the first relevant code changes so it cannot drift from reality.
- Maintenance (required):
  - Treat the guide as a maintained artifact, not a one-off doc.
  - Whenever a change set materially affects how an assistant should use the library (public exports, configuration shape/semantics, runtime invariants, query contracts, paging tokens, projection behavior, adapter responsibilities, or common pitfalls), update the guide in the same change set.
  - When deprecating/renaming APIs or changing semantics, update the guide and include migration guidance (old → new), but keep it concise.
- Intent (what the guide must enable):
  - Provide a self-contained description of the “mental model” (runtime behavior and invariants) and the minimum working patterns (how to configure, how to call core entrypoints, how to integrate a provider/adapter).
  - Include only the information required to use the library correctly; omit narrative or historical context.
- Constraints (how to keep it effective and reusable):
  - Keep it compact: “as short as possible, but as long as necessary.”
  - Make it self-contained: do not require readers to import or open `.d.ts` files, TypeDoc pages, or other repo docs to understand core contracts.
  - Avoid duplicating durable requirements or the dev plan:
    - Requirements belong in `stan.requirements.md`.
    - Work tracking belongs in `stan.todo.md`.
    - The assistant guide should focus on usage contracts and integration.
  - Define any acronyms locally on first use within the guide (especially if used outside generic type parameters).
