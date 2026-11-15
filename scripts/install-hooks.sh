#!/bin/sh
# Installs a local pre-commit hook that scans staged changes for secrets.
# The repo is public, so nothing that looks like a credential may be committed.
set -eu

hooks_dir=$(git rev-parse --git-path hooks)
mkdir -p "$hooks_dir"
hook="$hooks_dir/pre-commit"

cat > "$hook" <<'HOOK'
#!/bin/sh
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "pre-commit: gitleaks is not installed; install it (brew install gitleaks) before committing." >&2
  exit 1
fi
gitleaks git --pre-commit --staged --redact --no-banner --exit-code 1
HOOK

chmod +x "$hook"
echo "installed $hook"
