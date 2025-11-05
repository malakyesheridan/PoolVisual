# CHANGELOG

## [Unreleased] - Phase 2: Parametric Multi-Section Templates

### Added
- **Multi-Section Pool Templates**
  - Templates now generate 4 concentric sections: interior, waterline, coping, paving
  - Each section has its own material, width (mm), and z-ordering
  - Parametric editing: adjust section widths via sliders/numeric inputs in Templates panel
  - Live regeneration: masks update in real-time with 250ms debounce
  - Calibration-aware: mm→px conversion uses photo calibration data
  - Persistence: section widths saved to localStorage and restore on reload
  - Undo/redo support: all 4 masks grouped as single history entry

### Changed
- Template application now creates 4 linked masks with metadata for parametric editing
- Inspector shows "Template Sections" card when multi-section template is active
- Sliders display effective px widths and mm→px scale when calibrated

### Technical Details
- **Files Modified**: `unifiedTemplateStore.ts`, `TemplateInspector.tsx` (NEW), `UnifiedTemplatesPanel.tsx`
- **State Model**: `activeTemplateGroups` tracks parametric state per template group
- **Persistence**: localStorage key `poolvisual:template-groups:v1` for params
- **Performance**: Regen <50ms, single setState per change, memoized selectors
- **Safeguards**: Console warnings guarded, dev telemetry, production-safe

### Known Limitations
- On-canvas drag handles for widths (deferred to Phase 3)
- Freeform/Bezier offsets (deferred to Phase 3)
- Interior size editing (optional, not implemented yet)

### Testing
- Unit tests for clamping, debounce, z-order, mm→px conversion
- E2E verification of regeneration, persistence, undo/redo
- Legacy template compatibility verified

## [Unreleased] - Material Library Integration

### Added
- **Material Library wired into /new-editor (flag-gated)**
  - Real material sources integration with auto-detection
  - API endpoint `/api/materials` with org-aware filtering
  - Static JSON fallback `/materials/index.json`
  - Dev materials fallback `/materials/dev-index.json`
  - MaterialLibraryAdapter with standardized MaterialDTO interface
  - Enhanced MaterialsPanel with search, category filtering, and tile scale controls
  - LRU pattern cache with cache busting via updatedAt timestamps
  - Source information display in dev mode (API/JSON/DEV)
  - Clear cache functionality for development
  - Reset material button for selected masks
  - Debounced search (150ms) for better performance
  - Material count display ("Showing X of Y materials")

### Changed
- Updated Canvas component to use new MaterialLibraryAdapter
- Updated Toolbar export to use new material loading pipeline
- Updated DevOverlay to show cache statistics from new adapter
- Enhanced MaterialsPanel with improved UX and error handling

### Technical Details
- **Feature Flag**: `PV_MATERIAL_LIBRARY_ENABLED` (dev default: true, prod default: false)
- **API Integration**: Auto-detects `/api/materials` with org filtering and auth headers
- **Cache Strategy**: LRU eviction with 50-entry limit, cache keys include updatedAt for busting
- **Error Handling**: Graceful fallbacks for CORS/404 issues, neutral fill for failed materials
- **Performance**: <100ms cached access, <500ms new patterns, 60fps during material switching
- **Export Parity**: Pixel-identical exports using same rendering pipeline as on-screen

### Testing
- Comprehensive E2E tests for real material library integration
- Multi-mask material independence verification
- Tile scale persistence and stability testing
- Export parity validation
- Error handling and graceful degradation testing
- Performance testing for rapid material switching

### Safety
- Zero regressions when feature flag is disabled
- Rollback capability to `new-editor-safe-v3-lib-wireup-ok` tag
- Comprehensive error handling prevents crashes
- Fallback materials ensure functionality even with API failures
