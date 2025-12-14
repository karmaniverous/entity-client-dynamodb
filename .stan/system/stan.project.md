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

## TypeDoc

- All exported functions, classes, interfaces, types, and enums MUST have TypeDoc comments.
- Function and method TypeDoc comments MUST document all parameters and the return type.
- All properties of exported interfaces and interface-like types MUST have TypeDoc comments. **CRITICAL: Do NOT convert types to interfaces purely to support TypeDoc property comments; TypeDoc supports property comments on object types.**
- All generic type parameters in exported functions, classes, interfaces, and types MUST be documented in TypeDoc comments.
- Every TypeDoc comment MUST include a summary description.
- TypeDoc comments MUST use proper formatting for code elements (e.g., backticks for code references).
- Special characters in TypeDoc comments (e.g. <, >, {, }) MUST be escaped with a backslash ('\') to avoid rendering issues.
