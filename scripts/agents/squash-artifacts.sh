#!/usr/bin/env bash
# ==============================================================================
# 🗜️ Artifact Squash & Archive Script (scripts/agents/squash-artifacts.sh)
# ==============================================================================
# 1. Squashes .review.md + .task.md + .walkthrough.md triplets in docs/artifacts/
#    into single .summary.md files to save token space (~66% reduction).
# 2. Archives all numbered artifacts by decade groups (001-010, 011-020, ...)
#    into ###-###.archive.md files and cleans up originals.
#
# Usage:
#   bash scripts/agents/squash-artifacts.sh                # Squash triplets AND Archive decade groups
#   bash scripts/agents/squash-artifacts.sh --dry           # Dry run for both Squash and Archive
#   bash scripts/agents/squash-artifacts.sh --archive       # Run ONLY the decade group archiving
#   bash scripts/agents/squash-artifacts.sh --archive --dry # Dry run for ONLY archiving
# ==============================================================================
set -euo pipefail

ARTIFACTS_DIR="docs/artifacts"
MODE="${1:-}"

# ──────────────────────────────────────────────────────────────────────────────
# 📦 Archive Function: Groups all numbered artifacts by decade (001-010, ...)
# ──────────────────────────────────────────────────────────────────────────────
run_archive() {
    local dry_run=$1
    echo "📦 Starting decade group archiving (.archive.md)..."

    find_files() {
        find "$ARTIFACTS_DIR" -maxdepth 1 -name "$1" -type f 2>/dev/null | sort
    }

    # Collect all numbered artifact files (exclude .archive.md and INDEX.md)
    local all_artifacts=()
    while IFS= read -r f; do
        all_artifacts+=("$f")
    done < <(find "$ARTIFACTS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9]-*.md' -type f ! -name '*.archive.md' 2>/dev/null | sort)

    if [ "${#all_artifacts[@]}" -eq 0 ]; then
        echo "✅ No numbered artifacts to archive."
        return 0
    fi

    # Extract unique numeric prefixes
    local prefixes=()
    while IFS= read -r p; do
        prefixes+=("$p")
    done < <(for f in "${all_artifacts[@]}"; do
        basename "$f" | sed -E 's/^([0-9]+)-.*/\1/'
    done | sort -u)

    # Group by decade
    declare -A decade_groups
    for p in "${prefixes[@]}"; do
        local decade=$(( (10#$p - 1) / 10 * 10 + 1 ))
        local key=$(printf "%03d" $decade)
        decade_groups["$key"]+="$p "
    done

    local ARCHIVE_COUNT=0
    for decade_start in $(printf "%s\n" "${!decade_groups[@]}" | sort); do
        local start_num=$((10#$decade_start))
        local end_num=$((start_num + 9))
        local range_end=$(printf "%03d" $end_num)
        local archive_file="$ARTIFACTS_DIR/${decade_start}-${range_end}.archive.md"

        # Collect all files in this decade range
        local archive_sources=()
        for p in ${decade_groups["$decade_start"]}; do
            while IFS= read -r f; do
                archive_sources+=("$f")
            done < <(find_files "$p-*" ! -name '*.archive.md' | sort)
        done

        if [ "${#archive_sources[@]}" -eq 0 ]; then
            continue
        fi

        if $dry_run; then
            echo "[DRY] Would archive into $archive_file:"
            for f in "${archive_sources[@]}"; do echo "      - $f"; done
            echo ""
            continue
        fi

        # Merge into archive file
        {
            echo "# Archive: ${decade_start}–${range_end}"
            echo ""
            echo "> Archived from ${#archive_sources[@]} artifact(s) in range ${decade_start}–${range_end}"
            echo ""
            echo "---"
            echo ""
            for f in "${archive_sources[@]}"; do
                local stem=$(basename "$f" .md)
                echo "## $stem"
                echo ""
                cat "$f"
                echo ""
                echo "---"
                echo ""
            done
        } > "$archive_file"

        for f in "${archive_sources[@]}"; do
            rm "$f"
        done

        ARCHIVE_COUNT=$((ARCHIVE_COUNT + 1))
        echo "  ✓ Created $archive_file (${#archive_sources[@]} files)"
    done

    echo "🎉 Archived $ARCHIVE_COUNT decade group(s) into .archive.md"
}

# ──────────────────────────────────────────────────────────────────────────────
# 🗜️ Squash Function: Squashes .review.md + .task.md + .walkthrough.md triplets
# ──────────────────────────────────────────────────────────────────────────────
run_squash() {
    local dry_run=$1
    local COUNT=0
    echo "🗜️ Starting triplet squashing (.summary.md)..."

    find_files() {
        find "$ARTIFACTS_DIR" -maxdepth 1 -name "$1" -type f 2>/dev/null | sort
    }

    local all_prefixes=""
    all_prefixes=$(
        {
            find_files "*-*.review.md"
            find_files "*-*.task.md"
            find_files "*-*.walkthrough.md"
        } | sed -E 's|.*/([0-9]+)-.*|\1|' | sort -u | grep -v '^$' || true
    )

    if [ -z "$all_prefixes" ]; then
        echo "✅ Nothing to squash."
        return 0
    fi

    while IFS= read -r prefix; do
        [ -z "$prefix" ] && continue

        mapfile -t reviews < <(find_files "$prefix-*.review.md")
        mapfile -t tasks < <(find_files "$prefix-*.task.md")
        mapfile -t walks < <(find_files "$prefix-*.walkthrough.md")

        # Determine stem: use the first file's basename without suffix
        local first_file=""
        if [ "${#reviews[@]}" -gt 0 ]; then
            first_file="${reviews[0]}"
        elif [ "${#tasks[@]}" -gt 0 ]; then
            first_file="${tasks[0]}"
        elif [ "${#walks[@]}" -gt 0 ]; then
            first_file="${walks[0]}"
        fi
        [ -z "$first_file" ] && continue

        local stem=$(basename "$first_file" | sed -E 's/\.(review|task|walkthrough)\.md$//')
        local summary="$ARTIFACTS_DIR/$stem.summary.md"

        if $dry_run; then
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
            local basenames=""
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

    echo "✅ Squashed $COUNT artifact set(s) into .summary.md"
}

# ──────────────────────────────────────────────────────────────────────────────
# 🚀 Execution Flow Control
# ──────────────────────────────────────────────────────────────────────────────
if [ "$MODE" = "--archive" ]; then
    DRY=false
    [[ "$*" == *"--dry"* ]] && DRY=true
    run_archive "$DRY"
    exit 0
fi

# Default Mode: run Squash AND Archive sequentially
DRY=false
if [ "$MODE" = "--dry" ]; then
    DRY=true
fi

run_squash "$DRY"
echo ""
run_archive "$DRY"
