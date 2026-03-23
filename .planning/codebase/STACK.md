# STACK.md — Technologies & Dependencies

## Runtime & Language

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | `^5.9.3` |
| Target runtime | Node.js | `>=18` (syntax target: `node 18`) |
| ES target | ES2022 lib / ES2018 output | — |
| Module system | ESM (`"type": "module"`) | — |

## Build Tooling

| Tool | Role | Version |
|------|------|---------|
| **Rslib** | Library bundler (wraps Rspack) | `^0.20.0` |
| **Rspack** | Underlying bundler engine | (via Rslib) |

Build config: `rslib.config.ts`  
- Single output format: **ESM**  
- Generates TypeScript declarations (`.d.ts`) alongside JS  
- Syntax target: `node 18`

```ts
// rslib.config.ts
export default defineConfig({
  lib: [{ format: 'esm', syntax: ['node 18'], dts: true }],
});
```

## Testing

| Tool | Role | Version |
|------|------|---------|
| **Rstest** | Test runner (Vitest-like, Rspack-native) | `^0.9.0` |
| **@rstest/adapter-rslib** | Integration adapter for Rslib projects | `^0.2.1` |

Config: `rstest.config.ts`  
```ts
export default defineConfig({ extends: withRslibConfig() });
```

Test files live in `tests/` with `*.test.ts` pattern.

## Linting & Formatting

| Tool | Role | Version |
|------|------|---------|
| **Biome** | Linter + formatter (replaces ESLint + Prettier) | `2.4.6` |

Config: `biome.json`  
- Indent style: spaces  
- JS quote style: single quotes  
- VCS integration: git-aware (respects `.gitignore`)  
- Linter: recommended rules enabled  
- Import organization: automatic (`organizeImports: "on"`)

## Package Management

- **pnpm** (lockfile present: `pnpm-lock.yaml`)

## Dependencies

**Production dependencies:** None — this is a zero-dependency library.

**Dev dependencies only:**

```json
{
  "@biomejs/biome": "2.4.6",
  "@rslib/core": "^0.20.0",
  "@rstest/adapter-rslib": "^0.2.1",
  "@rstest/core": "^0.9.0",
  "@types/node": "^24.12.0",
  "typescript": "^5.9.3"
}
```

## Distribution

- Output directory: `dist/`
- Entry: `dist/index.js` (ESM) + `dist/index.d.ts` (types)
- Package exports:
  ```json
  { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }
  ```
- Package is **private** (`"private": true`) — not published to npm.

## NPM Scripts

| Command | Action |
|---------|--------|
| `pnpm run build` | Production build via Rslib |
| `pnpm run dev` | Watch mode build |
| `pnpm run test` | Run Rstest suite |
| `pnpm run test:watch` | Watch mode tests |
| `pnpm run format` | Format with Biome |
| `pnpm run check` | Lint + format with auto-fix |
