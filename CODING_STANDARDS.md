# Coding standards

Judgement calls only. Mechanical rules live in `scripts/check-standards.sh`, `.oxlintrc.json` and `.husky/`.

- **Dispatch**: object-map by default. `switch` only with evidence (fallthrough, or sibling code already uses `switch`).
- **UI prototypes**: visual language from the references, structure and data from the real app. Every metric shown exists in the data model.
- **UI bugs**: verified in the real browser (`localhost:5173`) in the exact context (e.g. the Repaso modal), not only jsdom.
- **Scratch**: clearing `.scratch/` removes only issues with Status resuelto/wontfix.
