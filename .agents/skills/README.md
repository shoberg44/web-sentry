# Agent Skills Standard & Directory Structure

This directory contains workspace skills for Google Antigravity and Gemini coding agents.

## Discovery & Precedence

Antigravity and Gemini agents automatically discover workspace customizations by traversing from the current working directory up to the repository root.

- **Workspace Skills Root**: `.agents/skills/` (aliases: `.agent/skills/`, `.gemini/skills/`)
- **Loading Priority**:
  1. Workspace Project (`.agents/skills/`)
  2. Declared Configurations (`skills.json` / `plugins.json`)
  3. Global User Configuration (`~/.gemini/config/`)
  4. Built-in Agent Customizations

## Skill Directory Layout

Each skill must reside in its own folder under `.agents/skills/<skill-name>/`:

```text
.agents/skills/
└── <skill-name>/
    ├── SKILL.md          # Required: Main instruction file with YAML frontmatter
    ├── scripts/          # Optional: Helper scripts and executable utilities
    ├── examples/         # Optional: Reference implementations and snippets
    ├── resources/        # Optional: Assets, schemas, or templates
    └── references/       # Optional: In-depth manuals and documentation
```

## `SKILL.md` Specification

Every `SKILL.md` must start with a YAML frontmatter block containing `name` and `description`:

```markdown
---
name: skill-name-kebab-case
description: >-
  Describe what the skill does and precisely WHEN the agent should activate it.
  Use third-person phrasing (e.g., "Use this skill when...").
---

# Skill Title

Step-by-step instructions, runbooks, or procedures for the agent.

## Steps

1. Run preparation helper: [prepare.sh](./scripts/prepare.sh)
2. Execute tests or build commands.
3. Validate output logs.
```

### Frontmatter Fields

- **`name`** (*string, required*): Unique identifier using lowercase kebab-case (e.g. `e2e-testing`, `deploy-service`).
- **`description`** (*string, required*): The agent uses this field during **progressive disclosure** to decide whether to activate the skill. Clearly specify trigger conditions and scope.

## Best Practices

1. **Progressive Disclosure**: Keep `SKILL.md` concise. Offload bulky background reading to `references/` and link to it relatively.
2. **Executable Helpers**: Place complex or repetitive multi-step shell commands in `scripts/`.
3. **Verification**: Always include explicit validation / verification steps so the agent can confirm success.
4. **Third-Person Trigger Descriptions**: Write trigger descriptions stating when the skill applies (e.g., *"Use this skill when modifying playwright end-to-end tests or running web sentry audits"*).
