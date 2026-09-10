#!/bin/sh
# Xcode Cloud post-clone step for ALLUR.
#
# Xcode Cloud checks out the repo on a fresh macOS runner and then runs this
# script before it builds/archives App.xcodeproj. The Xcode project does not
# contain the web app — it is generated here from artifacts/fitcoach:
#
#   1. install Node + pnpm
#   2. pnpm install (monorepo)
#   3. build the web bundle FOR NATIVE (needs VITE_REVENUECAT_IOS_KEY)
#   4. npx cap sync ios  -> copies dist/public into ios/App/App/public and
#      regenerates CapApp-SPM/Package.swift for the installed plugins
#
# Required workflow environment variable (Xcode Cloud -> workflow -> Environment):
#   VITE_REVENUECAT_IOS_KEY   RevenueCat public Apple SDK key (appl_...)
#
# See NATIVE_SETUP.md at the repo root for the rest of the release procedure.
set -eu

echo "== ALLUR ci_post_clone =="
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

if ! command -v node >/dev/null 2>&1; then
  brew install node
fi
node --version
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10
fi
pnpm --version

REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../../../.." && pwd)}"
cd "$REPO_ROOT"
echo "repo root: $REPO_ROOT"

pnpm install --frozen-lockfile

cd artifacts/fitcoach
: "${VITE_REVENUECAT_IOS_KEY:?VITE_REVENUECAT_IOS_KEY is not set. Add it to the Xcode Cloud workflow environment (RevenueCat -> API keys -> Apple App Store, starts with appl_).}"
VITE_NATIVE_BUILD=1 pnpm build

npx cap sync ios
echo "== web bundle synced into ios/App/App/public =="
ls ios/App/App/public | head -5
