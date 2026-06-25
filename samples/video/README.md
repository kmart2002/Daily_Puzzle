# Video Sample Annotations

This directory contains filled-out example annotations conforming to `schemas/video-edit-annotation.json`. Each file documents a single editorial decision in enough detail for an AI model to learn from it.

---

## What Each Field Means for AI Training

### Identity Fields

| Field | Training Purpose |
|-------|-----------------|
| `annotation_id` | Unique key for deduplication and cross-referencing in training pipelines |
| `schema_version` | Ensures the model is trained on consistent data; allows version-aware filtering |
| `created_at` | Enables temporal splitting (train on pre-2024, validate on 2024+) |

### Tool Provenance

The `tool` object tells the model *which software made this edit*. This matters because different NLEs make different decisions available (Shotcut's MLT filter system vs. OpenShot's Python-driven effects differ in granularity). A model trained on multi-tool data learns to distinguish tool-specific artifacts from universal editing patterns.

- `tool.name` — used to stratify the training set and ensure no single tool dominates
- `tool.version` — different versions of the same tool have different capabilities; version matters for reproducibility
- `tool.project_file` — traceability back to the source of truth

### Source Media

The `source_file` object describes the input media, not the output. Frame rate and resolution are critical features: a 24fps narrative cut behaves differently from a 60fps sports cut, and a model needs to learn both.

### Edit Type

`edit_type` is the primary classification label. Most supervised training tasks will use this as the target output. The enum is intentionally coarse (10 values) to keep the classification problem tractable while covering the full range of editorial work.

### Clip Geometry

The `clip` object provides the core input-output pair for timeline reasoning models:

- `in_point` and `out_point` define what was *selected* from the source
- `timeline_position` defines where it was *placed* in the output
- Together, these teach a model to predict "given this source material at this position in the sequence, where should the cut points be?"

Both `seconds` (floating-point, for precise computation) and `timecode` (SMPTE string, for display) are included. Use `seconds` for numeric models; `timecode` for retrieval and human review.

### Transition

The `transition` block, when present, provides the cut-to-cut relationship between consecutive clips. This is the data a generative model needs to learn transition selection — given two adjacent clips and their content, what transition type is appropriate?

`duration_frames` (not duration_seconds) is used because transition duration is naturally expressed in frame counts in every NLE.

### Color Grade

The `color_grade` block captures parametric color decisions. The lift/gamma/gain model (three-way color corrector) is the industry standard and is what Shotcut, OpenShot, and Lightworks all expose natively.

Key training implications:
- The `lut_applied` field is critical for identifying stylistic intent vs. technical correction
- HSL curves are stored as arrays of control points — they require a curve-fitting layer in any model that consumes them
- `temperature_kelvin` and `tint` encode white balance as semantically meaningful numbers rather than raw channel offsets

### Quality and Acceptance

`quality_rating` is a human judgment on a 1-5 scale. The rule is firm: **only ratings ≥ 3 are eligible for `accepted: true`**. This prevents low-quality examples from contaminating the positive training set.

`rejection_reason` uses a controlled vocabulary (enum) rather than free text. This is intentional: free-text rejection reasons cannot be reliably used for automatic filtering. The enum vocabulary was designed to cover the most common technical and editorial failure modes.

---

## Files in This Directory

| File | Edit Type | Tool | Rating | Accepted |
|------|-----------|------|--------|----------|
| `example-001.json` | rough_cut → fine_cut | Shotcut 23.11.29 | 4 | true |
| `example-002.json` | color_grade | OpenShot 0.3.0 | 5 | true |

---

## Adding New Samples

1. Copy the closest existing example.
2. Change `annotation_id` to the next sequential ID for today's date.
3. Fill in all required fields (a schema validator will catch missing ones).
4. Set `accepted: true` only if `quality_rating >= 3`.
5. If `accepted: false`, populate `rejection_reason` with one of the enum values.
6. Run: `python -c "import json,jsonschema; jsonschema.validate(json.load(open('your-file.json')), json.load(open('../../schemas/video-edit-annotation.json'))); print('OK')"`
