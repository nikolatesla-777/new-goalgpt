# Phase 5-1: Node.js LTS Pinning Proof

**Date:** 2025-12-23  
**Phase:** 5-1 (Production Parity)  
**Status:** ✅ **COMPLETE** — `.nvmrc` created with Node.js 22.11.0 (production target)

---

## Node.js Version Pinning

### .nvmrc File Creation

**Command:**
```bash
cat .nvmrc
```

**Output:**
```
22.11.0
```

**Analysis:** ✅ `.nvmrc` file created with Node.js 22.11.0 (production target).

---

## nvm Availability Check

**Command:**
```bash
which nvm || echo "nvm not found in PATH"
```

**Output:**
```
nvm not found in PATH
```

**Command:**
```bash
if command -v nvm >/dev/null 2>&1; then nvm use 2>&1 || echo "nvm use failed (nvm may not be sourced)"; else echo "nvm command not available"; fi
```

**Output:**
```
nvm command not available
```

**Analysis:** ⚠️ `nvm` is not available in this shell, so `nvm use` cannot be demonstrated locally. This does **not** invalidate the parity contract: `.nvmrc` defines the **required production Node version**. CI/CD (and/or Docker) must **enforce** Node.js 22.11.0 before building/running the server.

---

## Current Node.js Version

**Command:**
```bash
node -v
```

**Output:**
```
v24.11.1
```

**Analysis:** Current environment is running Node.js v24.11.1. Production must run Node.js **22.11.0** as specified in `.nvmrc`. (Different major versions can cause subtle runtime/tooling differences; we treat this as a production contract.)

---

## Parity Contract

**Production requirement:**
- Node.js version **must** equal: `22.11.0`
- Source of truth: `.nvmrc`

**Enforcement points (must have at least one):**
1) **CI/CD** sets Node to `22.11.0` (e.g., setup-node, runner image, or buildpack config)
2) **Docker** base image pins Node to `22.11.0` (or a digest) for the runtime stage
3) **PaaS/VM** installs Node `22.11.0` explicitly (system package, nvm/asdf, etc.)

**Local development:**
- Allowed to dev on a different Node version, but **do not treat local behavior as proof**.
- All acceptance/proof commands must be re-run under Node `22.11.0` in CI or Docker.

---

## Next Steps

1. Add a CI proof step that prints `node -v` and fails if it’s not `v22.11.0`.
2. Ensure the production deploy path (Docker/VM/PaaS) pins Node to `22.11.0` before `npm ci` / build.
3. (Optional hardening) Add `"engines": { "node": "22.11.0" }` to `package.json` and enable engine enforcement in CI.

---

## Known Risks (Why this matters)

- If CI/build runs on Node 24 but production runs on Node 22, you can get mismatched dependency resolution or runtime behavior.
- Therefore: **build and run** should both occur under the pinned Node version, or the runtime image should include the build artifacts produced under the same version.

---

**End of Node.js Parity Proof**


