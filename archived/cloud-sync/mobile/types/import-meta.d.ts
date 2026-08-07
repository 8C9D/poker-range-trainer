// Mobile-only ambient augmentation so the reused `@core/cloud/cloudConfig` — which references
// `import.meta.env` (a Vite-only API) at module load — type-checks under the mobile tsconfig (the
// web side gets this from `vite/client`). The native cloud env seam (`platform/cloudEnv.ts`)
// injects an explicit env instead, so this only needs to make `import.meta.env` a valid
// expression; its value is never read on device. No `src/` edit.
interface ImportMeta {
  readonly env?: Record<string, string | undefined>;
}
