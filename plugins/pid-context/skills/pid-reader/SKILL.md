---
name: pid-reader
description: Use when a user asks about P&ID drawings, equipment, pipes, instruments, control loops, process flow, safety checks, or wants P&ID context exported for an LLM.
---

# P&ID Reader

Prefer the `pid-context` MCP tools when answering questions about P&ID content. Treat the drawing's `SemanticIR` as the source of engineering truth.

Use these tools first:

- `list_drawings` to discover available `.pid.json`, `.ir.json`, or `.json` drawing files.
- `get_drawing_summary` to understand the whole drawing.
- `get_equipment` when the question names a tag such as `R-101`, `E-101`, or `P-101`.
- `export_llm_context` when a compact Markdown context pack is useful for reasoning.

Do not infer equipment connections from visual layout alone when semantic entities or relations are available. If the drawing was created in draw.io, use exported semantic metadata from the document instead of raw geometry whenever possible.
