#!/bin/bash
# Rollback script for new-editor to stability checkpoint
# Usage: ./scripts/rollback-new-editor.sh

echo "Rolling back new-editor to stability checkpoint..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Check if the tag exists
if ! git tag -l | grep -q "new-editor-safe-v1"; then
    echo "Error: Tag 'new-editor-safe-v1' not found"
    echo "Available tags:"
    git tag -l
    exit 1
fi

# Create backup branch of current state
echo "Creating backup branch..."
git checkout -b backup-before-rollback-$(date +%Y%m%d-%H%M%S)

# Checkout the stability checkpoint
echo "Checking out stability checkpoint..."
git checkout new-editor-safe-v1

# Restore only the new_editor files from the checkpoint
echo "Restoring new_editor files..."
git checkout new-editor-safe-v1 -- client/src/new_editor/

echo "Rollback complete!"
echo "Current state backed up to branch: backup-before-rollback-$(date +%Y%m%d-%H%M%S)"
echo "To restore your work: git checkout backup-before-rollback-$(date +%Y%m%d-%H%M%S)"
