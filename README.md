# Media AI Training Dataset Pipeline

A professional pipeline for creating, annotating, and curating high-quality labeled datasets from video and audio editing projects — purpose-built to train AI models on real-world media production workflows.

---

## What Is AI Training Data for Media?

AI models that generate or understand video and audio — whether for auto-editing, style transfer, noise reduction, or generative music — need to learn from labeled examples of *human editorial decisions*. That means:

- **For video:** Clip selections, cut timing, transition choices, color grade parameters, pacing decisions, and why a particular take was accepted or rejected.
- **For audio:** Instrument balance, EQ and compression settings, tempo and key metadata, mix ratios, and the editorial reasoning behind track arrangement.

Raw footage and audio are not training data. **Annotated, structured, consistently formatted examples** are training data.

This repository is a working implementation of a pipeline that takes raw edits from professional open-source tools and converts them into structured JSON annotations suitable for ingestion by ML training frameworks.

---

## Repository Structure

```
.
├── schemas/
│   ├── video-edit-annotation.json   # JSON Schema: video annotation format
│   └── audio-edit-annotation.json   # JSON Schema: audio annotation format
├── samples/
│   ├── video/
│   │   ├── README.md                # Field-by-field explanation
│   │   ├── example-001.json         # Rough cut → clean cut (Shotcut)
│   │   └── example-002.json         # Color grade edit (OpenShot)
│   └── audio/
│       ├── README.md                # Field-by-field explanation
│       ├── example-001.json         # Music mix (LMMS)
│       └── example-002.json         # Voice/podcast edit (Ardour)
├── workflows/
│   ├── shotcut-workflow.md          # AI training cuts in Shotcut
│   ├── openshot-workflow.md         # AI training cuts in OpenShot
│   ├── lmms-workflow.md             # AI training data from LMMS projects
│   └── ardour-workflow.md           # AI training data from Ardour sessions
└── web/
    ├── index.html                   # Portfolio site
    └── styles.css                   # Extracted CSS
```

---

## Tools Used

### Video Editing
| Tool | Platform | Why It's Used |
|------|----------|---------------|
| [Shotcut](https://shotcut.org/) | Windows / macOS / Linux | MLT-based timeline, precise frame-level control, XML project files ideal for parsing |
| [OpenShot](https://www.openshot.org/) | Windows / macOS / Linux | Python-based, JSON project format, scriptable for bulk annotation extraction |
| [Lightworks](https://lwks.com/) | Windows / macOS / Linux | Professional NLE used in broadcast; EDL export for precise cut-point data |

### Audio Editing
| Tool | Platform | Why It's Used |
|------|----------|---------------|
| [LMMS](https://lmms.io/) | Windows / macOS / Linux | XML project files expose BPM, instrument chains, note data — highly parseable |
| [Ardour](https://ardour.org/) | Linux / macOS | Industry-grade DAW; session XML contains full routing, plugin chains, automation |

---

## How to Use This Repo

### 1. Validate an annotation against the schema
```bash
# Install a JSON Schema validator
pip install jsonschema

# Validate a video annotation
python -c "
import json, jsonschema
schema = json.load(open('schemas/video-edit-annotation.json'))
sample = json.load(open('samples/video/example-001.json'))
jsonschema.validate(sample, schema)
print('Valid.')
"
```

### 2. Add your own annotation
Copy the closest example file, fill in all required fields, validate against the schema, and commit. See the per-tool workflow docs in `workflows/` for what to capture at each editing step.

### 3. Batch export from project files
Each workflow doc includes notes on how to extract annotation data programmatically from the tool's native project format (MLT XML for Shotcut, JSON for OpenShot, XML for LMMS and Ardour).

---

## Annotation Quality Standards

Every annotation in this dataset meets the following criteria:

- **Completeness:** All required schema fields are populated.
- **Accuracy:** Timecodes and parameters reflect the actual edit, not approximations.
- **Rejection reasoning:** Rejected clips include a `rejection_reason` string from the controlled vocabulary.
- **Tool traceability:** The `tool` field matches one of the approved tools and includes the exact version used.
- **Diversity:** No two accepted annotations in the same category should share identical parameter sets. The dataset is curated to cover the full range of each parameter space.

---

## Contributing

1. Follow the schema exactly — no extra fields, no missing required fields.
2. Use the rejection vocabulary defined in each schema's `rejection_reason` enum.
3. Include a `source_file` reference (can be anonymized as `project-YYYYMMDD-NNN`).
4. Run schema validation before committing.

---

## License

Annotations and schemas: MIT. Source media files (not included in this repo) remain under their original licenses.
