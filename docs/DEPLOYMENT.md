# Deploy AeroForge on Cloudflare Pages

AeroForge builds to static files. The browser runs the ONNX model locally, so the host only serves HTML, CSS, JavaScript, model files and WebAssembly. The release export can be checked locally with Wrangler. Public publishing and verification require the approved Cloudflare project and its actual HTTPS URL.

## Build and verify locally

Use Node.js 24.11.0 and npm 11.6.1. Playwright uses installed Chrome on Windows. On Linux, install its matching Chromium with `npx playwright install --with-deps chromium` on a machine where dependency installation is authorized.

```sh
cd web
npm ci
npm run verify
```

The build writes `web/out`. The export check verifies required routes and assets, the accepted ONNX hash, the absence of Pages runtime entry points, and the Free-plan file budgets. Playwright runs against the exported files. GitHub Actions produces a downloadable `cloudflare-pages-static-export` artifact after verification.

To verify Cloudflare Pages routing and headers locally, start Wrangler in one terminal:

```sh
cd web
npx --yes wrangler@4.162.0 pages dev out --ip 127.0.0.1 --port 4177 --compatibility-date 2026-11-13
```

From a second terminal, run:

```sh
cd web
npm run smoke:pages -- http://127.0.0.1:4177/
```

The same smoke command accepts the real HTTPS URL after publishing. It opens the studio, a shared design, the evidence page and the inference fixture. It checks prediction and mobile layout, same-origin runtime requests, MIME types, the downloaded model and preprocessing hashes, manifest equality, versioned caching, and a 404 for missing WASM.

## Free project settings

Once the repository owner approves the release commit and Cloudflare account, push the approved commits to the release branch. In **Workers & Pages → Create → Pages → Import an existing Git repository**, authorize the Cloudflare GitHub app for `marbo786/AeroForge` and select the repository.

| Setting | Value |
| --- | --- |
| Cloudflare plan | Free |
| Production branch | `main`, after the owner approves the release |
| Root directory | `web` |
| Framework preset | Next.js (Static HTML Export) |
| Build command | `npm ci --include=dev && npm run build && npm run check:pages` |
| Build output directory | `out`, relative to `web` |
| Build variables | `NODE_VERSION=24.11.0`, `SKIP_DEPENDENCY_INSTALL=1` |
| Runtime bindings and secrets | None |

The build needs the complete repository checkout because it reads the shared geometry and accepted model assets from sibling directories. Check the Node and npm versions in the build log. Use the supplied `pages.dev` hostname. Preview builds are optional and count toward the Free build quota. The export uses ordinary static directory routes and includes a top-level 404 page and a Pages `_headers` file. Keep immutable model and runtime paths versioned when their bytes change. [Static Next.js setup](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/) · [Build image and variables](https://developers.cloudflare.com/pages/configuration/build-image/) · [Headers](https://developers.cloudflare.com/pages/configuration/headers/)

Free Pages currently allows 500 builds per month, one concurrent build, up to 20 minutes per build, 20,000 files per site, and 25 MiB per asset. Requests that serve static assets without invoking Functions are free and unlimited. [Free plan limits](https://developers.cloudflare.com/pages/platform/limits/) · [Static asset pricing](https://developers.cloudflare.com/pages/functions/pricing/)

For a manually managed project, choose **Direct Upload** instead and upload the verified export directory. A Direct Upload project cannot later switch to Git integration. [Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Confirm publication

1. Confirm the deployment lists the approved commit and produced the expected HTTPS URL.
2. Run `npm run smoke:pages -- https://<actual-project>.pages.dev/` from `web` and record the result.
3. Verify the first and repeat visits in a browser. Check model and WASM requests, console errors, cache behavior and shared URL restoration. Confirm the account shows a Free Pages project with static requests and no bindings.
4. Record the tested HTTPS URL and release commit in the README and progress tracker. If a release needs reverting, use Pages deployment rollback and repeat the smoke check against the production URL.

The v2 deployment passed the public HTTPS smoke test on 2026-11-16. Both public GLBs and the poster matched the merged `main` tree at `075bf74`. The Pages deployment metadata, a separately identified preview, and the rollback target still need V2.6 verification. The preceding Git source baseline is `e8e0ea0`. [Live Studio](https://aeroforge-9tf.pages.dev/) · [V2 release evidence](RELEASE_CHECKLIST.md) · [Historical v1 audit](RELEASE.md)
