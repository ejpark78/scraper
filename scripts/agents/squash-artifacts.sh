#!/usr/bin/env bash
# ==============================================================================
# 🗜️ Artifact Squash Script (scripts/agents/squash-artifacts.sh)
# ==============================================================================
# Squashes .review.md + .task.md + .walkthrough.md triplets in docs/artifacts/
# into single .summary.md files to save token space (~66% reduction).
#
# Usage:
#   bash scripts/agents/squash-artifacts.sh              # squash all triplets
#   bash scripts/agents/squash-artifacts.sh --dry         # dry run (show what would be squashed)
#   bash scripts/agents/squash-artifacts.sh --batch       # batch .summary.md by decade groups
#   bash scripts/agents/squash-artifacts.sh --batch --dry # dry run for batch mode
#
# --batch mode:
#   Groups existing .summary.md files by decade (001-010, 011-020, ...)
#   and merges each group into a single ###-###.batch.md file, then deletes
#   the original .summary.md files.
#
# Preserved files (never squashed/deleted):
#   .spec.md, .adr.md, .plan.md, .issue.md, .test.md
# ==============================================================================
set -euo pipefail

ARTIFACTS_DIR="docs/artifacts"
COUNT=0
MODE="${1:-}"

# ──────────────────────────────────────────────────────────────────────────────
# --batch mode: group .summary.md by decade (001-010, 011-020, ...)
# ──────────────────────────────────────────────────────────────────────────────
if [ "$MODE" = "--batch" ]; then
    BATCH_DRY=false
    [[ "$*" == *"--dry"* ]] && BATCH_DRY=true

    find_files() {
        find "$ARTIFACTS_DIR" -maxdepth 1 -name "$1" -type f 2>/dev/null | sort
    }

    # Collect all summary files
    summary_files=()
    while IFS= read -r f; do
        summary_files+=("$f")
    done < <(find_files "*.summary.md" | sort)

    if [ "${#summary_files[@]}" -eq 0 ]; then
        echo "✅ No .summary.md files to batch."
        exit 0
    fi

    # Extract unique numeric prefixes
    prefixes=()
    while IFS= read -r p; do
        prefixes+=("$p")
    done < <(for f in "${summary_files[@]}"; do
        basename "$f" | sed -E 's/^([0-9]+)-.*/\1/'
    done | sort -u)

    # Group by decade
    declare -A decade_groups
    for p in "${prefixes[@]}"; do
        decade=$(( (10#$p - 1) / 10 * 10 + 1 ))
        key=$(printf "%03d" $decade)
        decade_groups["$key"]+="$p "
    done

    BATCH_COUNT=0
    for decade_start in $(printf "%s\n" "${!decade_groups[@]}" | sort); do
        start_num=$((10#$decade_start))
        end_num=$((start_num + 9))
        range_end=$(printf "%03d" $end_num)
        batch_file="$ARTIFACTS_DIR/${decade_start}-${range_end}.batch.md"

        batch_sources=()
        for p in ${decade_groups["$decade_start"]}; do
            while IFS= read -r f; do
                batch_sources+=("$f")
            done < <(find_files "$p-*.summary.md" | sort)
        done

        if [ "${#batch_sources[@]}" -eq 0 ]; then
            continue
        fi

        if $BATCH_DRY; then
            echo "[DRY] Would batch into $batch_file:"
            for f in "${batch_sources[@]}"; do echo "      - $f"; done
            echo ""
            continue
        fi

        {
            echo "# Batch: ${decade_start}–${range_end}"
            echo ""
            echo "> Batched from ${#batch_sources[@]} artifact(s) in range ${decade_start}–${range_end}"
            echo ""
            echo "---"
            echo ""
            for f in "${batch_sources[@]}"; do
                stem=$(basename "$f" .summary.md)
                echo "## $stem"
                echo ""
                cat "$f"
                echo ""
                echo "---"
                echo ""
            done
        } > "$batch_file"

        for f in "${batch_sources[@]}"; do
            rm "$f"
        done

        BATCH_COUNT=$((BATCH_COUNT + 1))
        echo "  ✓ Created $batch_file (${#batch_sources[@]} files)"
    done

    echo "Batched $BATCH_COUNT decade group(s) into .batch.md"
    exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# Normal mode: squash .review.md + .task.md + .walkthrough.md triplets
# ──────────────────────────────────────────────────────────────────────────────
find_files() {
    find "$ARTIFACTS_DIR" -maxdepth 1 -name "$1" -type f 2>/dev/null | sort
}

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

    if [ "$MODE" = "--dry" ]; then
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
