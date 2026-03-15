# Repo Skills

Place repo-shared OpenAI/Codex skills in subdirectories under `.agents/skills/`.

Codex discovers skills from `.agents/skills/` in the current directory and walks upward toward the repo root, so root-level skills are repo-wide and nested skills can stay local to a subtree.

Each skill should live in its own folder and expose a `SKILL.md`.

Keep universal repo policy in `AGENTS.md`. Use skills only for specialized reusable workflows.
