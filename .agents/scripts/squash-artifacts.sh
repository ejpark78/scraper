#!/usr/bin/env bash
# ==============================================================================
# 🗜️ Artifact Squash & Archive Script (scripts/agents/squash-artifacts.sh)
# ==============================================================================
# 1. Squashes .review.md + .task.md + .walkthrough.md triplets in docs/artifacts/
#    into single .summary.md files to save token space (~66% reduction).
# 2. Archives all numbered artifacts by decade groups (001-010, 011-020, ...)
#    into ###-###.archive.md files and cleans up originals.
# 3. Automatically updates docs/artifacts/INDEX.md index file.
#
# Usage:
#   bash scripts/agents/squash-artifacts.sh                # Squash triplets AND Archive decade groups AND Update INDEX.md
#   bash scripts/agents/squash-artifacts.sh --dry           # Dry run for Squash, Archive, and INDEX.md update
#   bash scripts/agents/squash-artifacts.sh --archive       # Run ONLY the decade group archiving and update INDEX.md
#   bash scripts/agents/squash-artifacts.sh --archive --dry # Dry run for ONLY archiving
# ==============================================================================
set -eo pipefail

ARTIFACTS_DIR="docs/artifacts"
MODE="${1:-}"

# ──────────────────────────────────────────────────────────────────────────────
# 📝 Index Updater Function: Dynamically updates docs/artifacts/INDEX.md
# ──────────────────────────────────────────────────────────────────────────────
update_index_md() {
    local dry_run=$1
    local index_file="$ARTIFACTS_DIR/INDEX.md"

    if $dry_run; then
        echo "[DRY] Would dynamically update $index_file based on existing artifacts."
        return 0
    fi

    echo "📝 Updating INDEX.md dynamically..."
    {
        echo "# Artifact Index"
        echo ""
        echo "| 아카이브/파일 | 범위/설명 | 파일 | 파일 수 |"
        echo "|------|------|------|--------|"

        # 1. List all *.archive.md files
        local archives=()
        while IFS= read -r f; do
            [ -f "$f" ] && archives+=("$f")
        done < <(find "$ARTIFACTS_DIR" -maxdepth 1 -name '*.archive.md' -type f 2>/dev/null | sort)

        local idx=1
        for arch in "${archives[@]}"; do
            local bname=$(basename "$arch")
            local range=${bname%.archive.md}
            # Count the number of individual artifact headers in this archive file
            local file_count=0
            file_count=$(grep -c '^## [0-9][0-9][0-9]-' "$arch" || echo "0")
            echo "| $idx | $range | [$bname]($bname) | $file_count |"
            idx=$((idx + 1))
        done

        # 2. List remaining individual numbered artifacts (un-archived)
        local individual_files=()
        while IFS= read -r f; do
            [ -f "$f" ] && individual_files+=("$f")
        done < <(find "$ARTIFACTS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9]-*.md' -type f ! -name '*.archive.md' 2>/dev/null | sort)

        for ind in "${individual_files[@]}"; do
            local bname=$(basename "$ind")
            local prefix=$(echo "$bname" | sed -E 's/^([0-9]+)-.*/\1/')
            local desc=$(echo "$bname" | sed -E 's/^[0-9]+-(.*)\.md$/\1/')
            echo "|   | $desc | [$bname]($bname) | 1 |"
        done

        echo ""
        echo "## 📂 상세 아카이브 내역 (Archived Details)"
        echo ""

        for arch in "${archives[@]}"; do
            local bname=$(basename "$arch")
            local range=${bname%.archive.md}
            echo "### 📦 아카이브: $range ($bname)"
            echo ""
            
            while IFS= read -r header; do
                if [ -n "$header" ]; then
                    local clean_h=$(echo "$header" | sed -E 's/^## //')
                    # Make anchor slug compatible with markdown spec
                    local slug=$(echo "$clean_h" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9 _-]//g' | tr ' ' '-')
                    echo "- [$clean_h]($bname#$slug)"
                fi
            done < <(grep '^## [0-9][0-9][0-9]-' "$arch" || true)
            echo ""
        done
    } > "$index_file"

    echo "  ✓ INDEX.md updated successfully."
}

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

    # Extract unique decades
    local decades=()
    while IFS= read -r d; do
        decades+=("$d")
    done < <(
        for p in "${prefixes[@]}"; do
            local decade=$(( (10#$p - 1) / 10 * 10 + 1 ))
            printf "%03d\n" $decade
        done | sort -u
    )

    local ARCHIVE_COUNT=0
    for decade_start in "${decades[@]}"; do
        local start_num=$((10#$decade_start))
        local end_num=$((start_num + 9))
        local range_end=$(printf "%03d" $end_num)
        local archive_file="$ARTIFACTS_DIR/${decade_start}-${range_end}.archive.md"

        # Collect all files in this decade range
        local archive_sources=()
        for f in "${all_artifacts[@]}"; do
            local bname=$(basename "$f")
            local prefix=$(echo "$bname" | sed -E 's/^([0-9]+)-.*/\1/')
            local num=$((10#$prefix))
            if [ "$num" -le "$end_num" ] && [ "$num" -ge "$start_num" ]; then
                archive_sources+=("$f")
            fi
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
        if [ ! -f "$archive_file" ]; then
            {
                echo "# Archive: ${decade_start}–${range_end}"
                echo ""
                echo "> Archived from ${#archive_sources[@]} artifact(s) in range ${decade_start}–${range_end}"
                echo ""
                echo "---"
                echo ""
            } > "$archive_file"
        fi

        for f in "${archive_sources[@]}"; do
            local stem=$(basename "$f" .md)
            # Check if this feature header is already inside the archive to prevent duplication
            if grep -q "^## $stem" "$archive_file" 2>/dev/null; then
                echo "  ⚠ $stem is already archived in $(basename "$archive_file"). Skipping merge, deleting source."
                rm "$f"
                continue
            fi

            # Append to archive file
            {
                echo "## $stem"
                echo ""
                cat "$f"
                echo ""
                echo "---"
                echo ""
            } >> "$archive_file"
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

        reviews=()
        while IFS= read -r line; do
            [ -n "$line" ] && reviews+=("$line")
        done < <(find_files "$prefix-*.review.md")

        tasks=()
        while IFS= read -r line; do
            [ -n "$line" ] && tasks+=("$line")
        done < <(find_files "$prefix-*.task.md")

        walks=()
        while IFS= read -r line; do
            [ -n "$line" ] && walks+=("$line")
        done < <(find_files "$prefix-*.walkthrough.md")

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
    update_index_md "$DRY"
    exit 0
fi

# Default Mode: run Squash AND Archive sequentially, then update INDEX.md
DRY=false
if [ "$MODE" = "--dry" ]; then
    DRY=true
fi

run_squash "$DRY"
echo ""
run_archive "$DRY"
echo ""
update_index_md "$DRY"
