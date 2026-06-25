# media-ai-pipeline

Structured annotation pipeline for video and audio editing sessions. Produces labeled JSON datasets from native project files (MLT, OSP, MMP, Ardour XML) for use in ML training workflows.

Built around open-source NLEs and DAWs because their project formats are parseable — unlike proprietary formats (Premiere, Final Cut, Pro Tools) that require vendor SDKs or round-trip export hacks.

---

## Schemas

Two JSON Schemas define the annotation format:

- `schemas/video-edit-annotation.json` — covers cut edits, color grades, and transitions. Captures SMPTE timecodes, per-channel color grade values (lift/gamma/gain RGB), transition type and duration, and a controlled-vocabulary rejection reason.
- `schemas/audio-edit-annotation.json` — covers voice, music, and SFX tracks. Captures ordered signal chains with per-plugin parameters, EBU R128 LUFS values, tempo/key/time signature metadata, and noise event positions.

Both schemas use JSON Schema draft-07 with conditional `required` rules: `rejection_reason` becomes required when `accepted` is `false`.

### Validate locally

```bash
pip install jsonschema

python - <<'EOF'
import json, jsonschema, pathlib

schema = json.loads(pathlib.Path("schemas/video-edit-annotation.json").read_text())
sample = json.loads(pathlib.Path("samples/video/example-001.json").read_text())
jsonschema.validate(sample, schema)
print("ok")
EOF
```

---

## Samples

`samples/video/` and `samples/audio/` contain filled-out annotation examples. Each file validates against the corresponding schema.

| File | Tool | Edit type |
|------|------|-----------|
| `samples/video/example-001.json` | Shotcut 23.11.29 | Fine cut — dialogue |
| `samples/video/example-002.json` | OpenShot 3.1.1 | Color grade — warm highlights / cool shadows |
| `samples/audio/example-001.json` | LMMS 24.1.2 | Full music mix, 120 BPM, C minor |
| `samples/audio/example-002.json` | Ardour 8.4.0 | Podcast voice edit, 6-plugin chain, −16.8 LUFS |

---

## Workflows

`workflows/` has per-tool guides covering:

- Which project fields map to which annotation fields
- What makes a training example worth keeping vs. rejecting
- How to extract annotation data from native project files programmatically

Each guide includes a Python snippet that parses the tool's project format directly.

| Tool | Project format | Guide |
|------|---------------|-------|
| Shotcut | MLT XML (`.mlt`) | `workflows/shotcut-workflow.md` |
| OpenShot | JSON (`.osp`) | `workflows/openshot-workflow.md` |
| LMMS | MMP XML (`.mmp`) | `workflows/lmms-workflow.md` |
| Ardour | Session XML (`.ardour`) | `workflows/ardour-workflow.md` |

---

## Adding annotations

1. Copy the closest example from `samples/`
2. Change `annotation_id` — format is `VID-YYYYMMDD-NNNN` or `AUD-YYYYMMDD-NNNN`
3. Fill in all required fields (see schema for which are required vs optional)
4. If `accepted` is `false`, populate `rejection_reason` with a value from the schema enum
5. Validate before committing (see above)

For bulk extraction from project files, see the relevant workflow doc — all four tools have a Python extractor included.

---

## Rejection vocabulary

Annotations are only useful as negative examples if the rejection reason is consistent. Use the controlled vocabulary defined in each schema — don't freetext it.

**Video:** `motion_blur` · `out_of_focus` · `jump_cut` · `audio_desync` · `overexposed` · `underexposed` · `performance` · `framing`

**Audio:** `clipping` · `background_noise` · `latency_offset` · `low_signal` · `phase_issues` · `wrong_key` · `timing_drift`

---

## Tool coverage

| Tool | Category | Project format |
|------|----------|---------------|
| Shotcut | Video NLE | MLT XML |
| OpenShot | Video NLE | JSON |
| Lightworks | Video NLE | EDL |
| LMMS | DAW | MMP XML |
| Ardour | DAW | Session XML |

Lightworks annotation is supported at the schema level but the extractor script is not yet written — EDL parsing is straightforward, PRs welcome.

---

## Known limitations

- Color grade annotations capture three-way corrector values only (lift/gamma/gain). Node-based grading graphs (e.g., OpenShot's upcoming OpenColorIO integration) are not yet modeled.
- LMMS beat+bassline patterns are extracted at the pattern level, not individual beat steps. This loses granularity for rhythm-focused training tasks.
- Ardour automation lanes are not captured — only static plugin parameters at session close.

---

## License

MIT. Source media files referenced by annotations are not included in this repo and remain under their original licenses.
