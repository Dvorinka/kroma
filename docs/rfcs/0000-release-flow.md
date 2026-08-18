# RFC NNNN: a release flow that builds only what changed, and proves it built everything

- Status: **DRAFT**
- PR: #NNNN
- Affects: `.github/workflows/release.yml`, `.github/workflows/deploy.yml`, `.github/workflows/synology.yml`, `.github/scripts/resolve-version.sh`, `.github/scripts/verify-candidate.sh`, areas `area/server` and all client areas

## Summary

Keep the part of today's flow that is already better than most projects - build a
candidate on every push, promote it to a Release only behind a human approval - and fix
the three things that are below the industry norm: the version number is hand-edited with
no changelog, a candidate rebuilds every platform even when one file changed, and "the
candidate is complete" is not a single honest signal because the Synology `.spk` lives in
a second workflow checked only at promotion time. Adopt release-please for the version and
changelog; scope each platform build to its own paths; fold the `.spk` into the Candidate
gate. Do **not** split the core server+clients into independent versions the way the
`.kmod` modules are split - they are coupled by the API, and one product version is the
right answer for a self-hosted product.

## Motivation

Concrete failures from the last two days, all real:

1. **The version is hand-edited.** Cutting 0.1.39 meant a human editing `server/Cargo.toml`
   from `0.1.38`. There is no changelog, and the bump is always `+0.0.1` regardless of
   whether the delta was a `fix:` or a `feat:`. The norm - Conventional Commits (already
   ~90% followed here) driving SemVer and a generated `CHANGELOG.md` - is not in place.
2. **A candidate rebuilds the whole fleet for a one-platform change.** `release.yml`'s
   `paths-ignore` gates the *whole run*, but inside a run every platform builds
   unconditionally. A one-line Android TV fix rebuilds desktop, mobile and the server
   `.spk`. That is minutes of CI and cache pressure spent on bytes that did not change.
3. **"Complete" is assembled, not asserted.** The Candidate gate depends on
   `[version, tv, desktop, appletv, mobile]`. The Synology `.spk` is built by a *separate*
   workflow (`synology.yml`) and is only correlated to the commit at promotion time inside
   `verify-candidate.sh`. So a green Candidate gate does **not** mean the `.spk` exists;
   you find that out later, at deploy. There is no single check that says "this version
   built everywhere, `.spk` included."

## Proposal

Three independent changes; each stands alone and can land separately.

### 1. release-please owns the version and the changelog

Add a `release-please` job (manifest mode) that, on every push to `main`, maintains a
standing **Release PR**: it computes the next version from the Conventional Commits since
the last release (`fix:` -> patch, `feat:` -> minor, `!`/`BREAKING CHANGE` -> major),
bumps `server/Cargo.toml` (the single source of truth `resolve-version.sh` already reads),
and regenerates `CHANGELOG.md`. Merging that PR is the deliberate act that "opens" the
version - exactly the `chore(release): X` commit done by hand today, now generated.

Nothing downstream changes: the merge is a push to `main`, which builds the candidate for
the new version, which is promoted through `deploy.yml` behind the same `production`
approval. The two human gates stay: merge the Release PR, then approve the promotion.

Configuration lives in `release-please-config.json` + `.release-please-manifest.json`
(both plain repo files, not workflows).

### 2. Each platform builds only when its inputs change

Give every `_release-*.yml` leg a path predicate so a candidate rebuilds only the
platforms a commit can affect (`clients/tizen/**` -> TV only, `server/**` +
`clients/web/**` -> `.spk`, etc.), with a shared floor (root manifest, lockfiles, the
release workflows themselves) that rebuilds everything. A platform that legitimately did
not change is marked **reused, not skipped**: the candidate is still complete because its
artifact is carried forward from the last green build of that platform at the same or an
ancestor commit. Promotion assembles the newest green artifact per platform.

### 3. The Candidate gate covers the whole fleet, `.spk` included

Add the matching `synology.yml` run to what "complete" means, so a green Candidate gate is
a true statement that every promotable artifact exists. Move the `.spk`-exists assertion
out of `verify-candidate.sh` (late, at deploy) and into the gate (early, on the candidate).
A skipped or failed platform makes the gate fail, so a partial candidate can never look
promotable.

## What this costs

- **A new dependency + config surface**: release-please and two JSON config files to keep
  correct. Mitigated by it being the de-facto standard (googleapis and much of the Node
  ecosystem run it).
- **Path predicates are a maintenance burden**: get one wrong and a platform silently
  reuses a stale artifact. This is the sharpest edge; it argues for a conservative floor
  (when unsure, rebuild) and for the gate in change 3 as the backstop.
- **A carried-forward artifact must be addressable** by commit, which means retaining
  per-platform build artifacts long enough to reuse - some storage cost.

## Compatibility

- **Older clients / paired devices**: unaffected. The version scheme (`X.Y.Z`, one number
  for the fleet) does not change; only how the number is computed.
- **Modules**: unaffected. `.kmod` bundles keep their own `<id>@<version>` cadence in
  `modules.yml`. This RFC deliberately does not touch them.
- **In-flight release 0.1.39**: can ship on the current flow before any of this lands, or
  wait; the changes are backward-compatible with a hand-edited bump.

## Alternatives

- **Do nothing.** The flow works - 0.1.39 is fully promotable today. But every release
  keeps paying the manual-bump and full-rebuild cost, and "is it complete" stays a
  two-workflow correlation a human has to trust.
- **Split the core per platform, like the `.kmod` modules.** Rejected. Modules split
  *because they are independent* - optional, out-of-process, contract-bound sidecars. The
  server and clients are *coupled*: every client speaks the server API. Independent
  versions (`web 0.3`, `tizen 0.2`, `server 0.5`) would force an N×M compatibility matrix
  onto a self-hosted product where the user runs the server *and* installs the clients -
  the worst place to make "which version works with which" a support question. The norm
  bears this out: Angular versions its packages in lockstep (coupled), Babel versions them
  independently (decoupled); the deciding question is never "can we split" but "is it
  coupled". Split the **build** (change 2), not the **version**.
- **semantic-release** instead of release-please. Rejected: it tags automatically on push,
  which would bypass the promotion-behind-approval gate that is the best property of the
  current design.

## Unresolved

- **A server↔client API-compatibility number**, distinct from the product version, is the
  honest way to pin a client to a server the day an API break happens. Worth its own RFC;
  noted here so the single-version decision above is understood as "one *product* version",
  not "compatibility never needs expressing".
- **Implementation is gated on `workflow` scope.** Every change here edits
  `.github/workflows/**`. The automation account currently pushes with `repo` scope only
  (no `workflow`), so it cannot open the implementing branch itself. Decide: grant the
  scope for a review-only spike branch, or have a maintainer apply the workflow diffs this
  RFC specifies. The non-workflow parts (release-please config, changelog) can land
  without it.
