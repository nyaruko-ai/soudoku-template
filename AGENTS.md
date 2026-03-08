## Skills

### Available skills

- soudoku-novel-builder: Use this skill to create Soudoku novels, an original Japanese "creative reading" approach to building a novel step by step. (file: soudoku-novel-builder/SKILL.md)

## How to use skills

- Discovery: The skill listed above is available in this repository. Its instructions live in the referenced `SKILL.md`.
- Trigger rules: If the user names `$soudoku-novel-builder` or asks to create, continue, revise, or publish a novel in this repository, you must use this skill for the turn.
- Implicit trigger examples: Treat requests such as `小説を創ります`, `小説を作りたい`, `続きを書きたい`, `この小説を直したい`, `Webで読めるようにしたい` as reasons to use `soudoku-novel-builder`.
- Workflow: After deciding to use the skill, open `soudoku-novel-builder/SKILL.md` and read only what is needed to execute the task. Load referenced files only when needed.
- Fallback: If the skill file cannot be read, state that briefly and continue with the best available local workflow.
