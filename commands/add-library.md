# /add-library <source>

Register a component-library battery the forge can pull from.

1. Add an entry under `batteries/libraries/` describing the source (local path / npm / MCP registry URL) + a promptSnippet telling the forge how to use it.
2. The forge then references real primitives instead of hand-baking everything.
