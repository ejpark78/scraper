#!/usr/bin/env bash
# ==============================================================================
# 🗜️ Artifact Squash Script (scripts/agents/squash-artifacts.sh)
# ==============================================================================
# Squashes .review.md + .task.md + .walkthrough.md triplets in docs/artifacts/
# into single .summary.md files to save token space (~66% reduction).
#
# Usage:
#   bash scripts/agents/squash-artifacts.sh          # squash all triplets
#   bash scripts/agents/squash-artifacts.sh --dry     # dry run (show what would be squashed)
#
# Preserved files (never squashed):
#   .spec.md, .adr.md, .plan.md, .issue.md, .test.md
# ==============================================================================
set -euo pipefail

ARTIFACTS_DIR="docs/artifacts"
COUNT=0
DRY="${1:-}"

# Collect all review/task/walkthrough files (handle multi-line ls safely)
find_files() {
    find "$ARTIFACTS_DIR" -maxdepth 1 -name "$1" -type f 2>/dev/null | sort
}

# Collect unique ### prefixes from all review/task/walkthrough files
all_prefixes=$(
    {
        find_files "*-*.review.md"
        find_files "*-*.task.md"
        find_files "*-*.walkthrough.md"
    } | sed -E 's|.*/([0-9]+)-.*|\1|' | sort -u | grep -v '^$'
)

if [ -z "$all_prefixes" ]; then
    echo "✅ Nothing to squash."
    exit 0
fi

while IFS= read -r prefix; do
    [ -z "$prefix" ] && continue

    mapfile -t reviews < <(find_files "$prefix-*.review.md")
    mapfile -t tasks < <(find_files "$prefix-*.task.md")
    mapfile -t walks < <(find_files "$prefix-*.walkthrough.md")

    # Determine stem: use the first file's basename without suffix
    first_file=""
    if [ "${#reviews[@]}" -gt 0 ]; then
        first_file="${reviews[0]}"
    elif [ "${#tasks[@]}" -gt 0 ]; then
        first_file="${tasks[0]}"
    elif [ "${#walks[@]}" -gt 0 ]; then
        first_file="${walks[0]}"
    fi
    [ -z "$first_file" ] && continue

    stem=$(basename "$first_file" | sed -E 's/\.(review|task|walkthrough)\.md$//')
    summary="$ARTIFACTS_DIR/$stem.summary.md"

    if [ "$DRY" = "--dry" ]; then
        echo "[DRY] Would squash:"
        for f in "${reviews[@]}"; do echo "      - $f"; done
        for f in "${tasks[@]}"; do echo "      - $f"; done
        for f in "${walks[@]}"; do echo "      - $f"; done
        echo "      -> $summary"
        echo ""
        continue
    fi

    # Merge into summary
    {
        echo "# Summary: $stem"
        echo ""
        basenames=""
        for f in "${reviews[@]}"; do basenames="$basenames $(basename "$f")"; done
        for f in "${tasks[@]}"; do basenames="$basenames $(basename "$f")"; done
        for f in "${walks[@]}"; do basenames="$basenames $(basename "$f")"; done
        echo "> Squashed from:$basenames"
        echo ""
        echo "---"
        echo ""

        if [ "${#reviews[@]}" -gt 0 ]; then
            echo "## Review"
            echo ""
            for f in "${reviews[@]}"; do
                echo "### $(basename "$f" .md)"
                echo ""
                cat "$f"
                echo ""
            done
            echo "---"
            echo ""
        fi
        if [ "${#tasks[@]}" -gt 0 ]; then
            echo "## Task"
            echo ""
            for f in "${tasks[@]}"; do
                echo "### $(basename "$f" .md)"
                echo ""
                cat "$f"
                echo ""
            done
            echo "---"
            echo ""
        fi
        if [ "${#walks[@]}" -gt 0 ]; then
            echo "## Walkthrough"
            echo ""
            for f in "${walks[@]}"; do
                echo "### $(basename "$f" .md)"
                echo ""
                cat "$f"
                echo ""
            done
            echo "---"
            echo ""
        fi
    } > "$summary"

    # Delete originals
    for f in "${reviews[@]}"; do rm "$f"; done
    for f in "${tasks[@]}"; do rm "$f"; done
    for f in "${walks[@]}"; do rm "$f"; done

    COUNT=$((COUNT + 1))
done <<< "$all_prefixes"

echo "Squashed $COUNT artifact set(s) into .summary.md"
