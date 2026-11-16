# Repository size proposal

## Measurement

Phase E measured the sum of regular file lengths in the Git-tracked working tree on 2026-11-17. The sizes exclude Git object history, filesystem allocation overhead and generated or ignored output. The screenshot row counts still images under `docs/`. The README recording is listed separately.

| Scope | Files | Bytes | MiB |
| --- | ---: | ---: | ---: |
| `data/` | 5,909 | 13,484,188 | 12.86 |
| `artifacts/` | 73 | 12,469,622 | 11.89 |
| Screenshot images under `docs/` | 137 | 20,283,059 | 19.34 |
| README demo GIF under `docs/media/` | 1 | 1,379,007 | 1.32 |

The 37 MB estimate in the brief for `data/` differs from the measured logical size. The data includes thousands of small files whose allocation can increase the size reported by the filesystem. The recovery data accounts for 10,185,372 bytes across 4,466 tracked files. The `v2-5` screenshot set accounts for 8,121,490 bytes across 41 images.

## Keep in Git

- Keep all of `data/pilot-v1/` and `data/recovery-v1/` available in a clean checkout. The [pilot audit](../tests/python/test_xfoil.py) and [recovery audit](../tests/python/test_recovery.py) read manifests, labels, attempted cases, solver logs, polars and panel files from their original paths. They check recorded hashes and independently classify the solver output. The [pilot model audit](../tests/python/test_ml.py) also reads the frozen training dataset. Keep the configs, manifests, checksums and Git attributes that preserve original solver line endings.
- Keep the pilot and recovery graphs, model and preprocessing metadata and golden JSON read by the [web build](../web/scripts/prepare-assets.mjs) and numerical tests. Keep the pilot `mlp.pt` and the accepted `selected.pt`, training partitions and frozen evaluation, selection and unlock records required by the Python audits. Keep the recovery provenance, final reservation and deployment evidence in the repository.
- Keep the README GIF and the screenshots used inline by the phase reports. They render from the repository and make current and historical audits reviewable directly on GitHub.

## Storage options

| Option | Candidate | Requirements before any move |
| --- | --- | --- |
| GitHub Release assets | The 7,068,669-byte `artifacts/recovery-v1-complete/forest-finalist.joblib` is the first candidate. The Python suite and Pages build do not read it. The original finalization script reads it for the forest baseline, so retain the matching finalist ONNX and metrics locally and document how to restore the exact joblib to its recorded path. Supplementary screenshot bundles are another candidate. | Preserve the recorded SHA-256 and attach a checked manifest to a tagged release. Review screenshot links before moving any evidence and update the links in the same change. [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) |
| Git LFS | Consider for large future versioned binaries whose repository paths need to stay stable, such as additional vehicle assets or media. | Git LFS checkouts need the full object and GitHub source archives can contain pointers. Verify object materialization in local clones, CI and Cloudflare Pages before moving any file consumed by them. Account for storage and download usage. [Git LFS archives](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-git-lfs-objects-in-archives-of-your-repository) · [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs) |
| Hugging Face Hub | Consider publishing a versioned mirror of the frozen XFOIL datasets and diagnostic outputs for researchers. Keep the audit inputs checked in so the audit can still run offline. | Pin the mirror to an exact revision, preserve the data layout, and publish applicable provenance, licensing information and checksums. [Hugging Face repositories](https://huggingface.co/docs/hub/en/repositories-getting-started) |

Before approving any removal from the working tree, check all consumers from a fresh clone, verify exact bytes if restoration is required, and run the full Python audit, browser suite and static export asset checks. A forward-only removal would reduce the current working tree size while older Git objects would remain in history. This phase measured the files and recorded the options.
