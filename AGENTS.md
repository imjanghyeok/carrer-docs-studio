# Contributor and agent instructions

- This is the standalone, public-source edition. Do not search sibling folders for personal documents or copy their contents into this repository.
- Read README.md, docs/ARCHITECTURE.md and docs/CODE_STRUCTURE.md first. If a local-only .local/HANDOFF.md exists, read it for maintainer context; it is not part of a public clone.
- Public templates and fixtures must be blank or synthetic. Never use a contributor's actual resume, applications, screenshots, chat history, credentials or machine paths as examples.
- Default runtime data belongs outside the source checkout. Tests must set STUDIO_DATA to a fresh temporary directory and must not use a real AI account.
- Preserve HTML as the editable representation; do not silently replace it with images or a proprietary JSON format.
- Read docs/CODING_CONVENTIONS.md before editing. Run format:check and lint; keep formatting separate from behavior changes. Never format user HTML or template literals indiscriminately.
- Keep localhost-only binding, explicit AI transmission consent, proposal review and conflict protection. Do not weaken these to make a test pass.
- Run npm run check before proposing a release. The public-file scanner is a guardrail, not proof that a manual privacy review is unnecessary.
- Document implemented behavior in public docs. Keep unimplemented features, issue drafts and maintainer handoff notes in the Git-ignored .local directory; never add that directory to PUBLIC_FILES.json. Preserve user-facing privacy and operational safety information.
- Do not create a remote, publish, push, or choose a public license without the owner's explicit direction. No remote is needed for local development.
