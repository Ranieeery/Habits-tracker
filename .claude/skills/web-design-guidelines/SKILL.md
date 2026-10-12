---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read [guidelines.md](guidelines.md) in this skill folder (a local copy of the Vercel Web Interface Guidelines; do not fetch them from the web)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in guidelines.md
4. Output findings in the terse `file:line` format

## Guidelines Source

The rules and the output format live in `guidelines.md`, next to this file. It was copied from `vercel-labs/web-interface-guidelines` (`command.md`); update that file by hand when the upstream rules change.

## Usage

When a user provides a file or pattern argument:
1. Read guidelines.md
2. Read the specified files
3. Apply all rules from guidelines.md
4. Output findings using the format specified in guidelines.md

If no files specified, ask the user which files to review.
