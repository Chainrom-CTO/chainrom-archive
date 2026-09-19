#!/usr/bin/env bash
# Keep the `upstream` branch a faithful mirror of Bubbleduck10/chainrom.
#
# Only ever fast-forwards. If the source rewrites its history, the new history
# is kept on a dated branch instead and this script exits non-zero, so nothing
# the original author published is silently lost or replaced.
set -euo pipefail

SOURCE_URL="https://github.com/Bubbleduck10/chainrom.git"
SOURCE_BRANCH="master"
MIRROR_BRANCH="upstream"

# Fails (and so fails the job) if the source repository is gone.
git fetch --no-tags "$SOURCE_URL" "$SOURCE_BRANCH:refs/remotes/source/$SOURCE_BRANCH"

mirror=$(git rev-parse "refs/remotes/origin/$MIRROR_BRANCH")
source=$(git rev-parse "refs/remotes/source/$SOURCE_BRANCH")

if [ "$mirror" = "$source" ]; then
  echo "upstream unchanged at $mirror"
elif git merge-base --is-ancestor "$mirror" "$source"; then
  git push origin "$source:refs/heads/$MIRROR_BRANCH"
  echo "upstream advanced $mirror -> $source"
else
  kept="upstream-diverged-$(date -u +%Y%m%d)"
  git push origin "$source:refs/heads/$kept"
  echo "::error::source history was rewritten; new history kept on $kept, $MIRROR_BRANCH left as is"
  exit 1
fi
