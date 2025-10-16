#!/bin/bash
# Safety checkpoint for Material Library integration
# Tag: new-editor-safe-v3-lib-wireup-ok
# Date: $(date)

echo "Creating safety checkpoint: new-editor-safe-v3-lib-wireup-ok"
git tag new-editor-safe-v3-lib-wireup-ok

echo "Safety checkpoint created successfully!"
echo "To restore if needed: git checkout new-editor-safe-v3-lib-wireup-ok -- client/src/new_editor/"
