# OpenShot Workflow: Creating AI Training Cuts

OpenShot is a Python-based open-source NLE backed by libopenshot. Its project format is JSON — the most directly machine-readable of any NLE covered in this pipeline. This makes OpenShot particularly powerful for automated annotation extraction: project files can be parsed, validated, and partially auto-annotated with a Python script before a human annotator reviews and confirms.

---

## Why OpenShot for AI Training Data

- **Native JSON project format** (`.osp`): Every frame offset, transition, effect, and clip reference is stored as structured JSON. No XML parsing layer required.
- **Python API**: `openshot-qt` exposes `openshot.Timeline`, `openshot.Clip`, and `openshot.Transition` objects. You can build a batch annotation extractor in pure Python using the same library that powers the application.
- **Consistent color effect model**: OpenShot's color effects (Hue/Saturation/Brightness, Color Shift) have fixed parameter names that map directly to the `color_grade` schema fields.

---

## Setup

### Project Configuration

1. **File > Project Properties**:
   - FPS: Match source footage exactly. Mismatched FPS is the single most common source of rejected annotations.
   - Width/Height: Match source. Do not upscale.
   - Channel Layout: Stereo for most work; mono for single-microphone interview/dialogue capture.
   - Sample Rate: 48000 Hz for video; this is broadcast standard and avoids the resampling artifacts that occur when mixing 44100 Hz audio with a 48000 Hz timeline.

2. **View > Layout** — Use the "Advanced" layout so the Properties panel is visible at all times. You will reference it constantly during annotation.

3. **Preferences > Performance** — Set cache size to at least 512 MB. Stale cache frames corrupt the visual feedback you use to judge in/out points.

---

## Step 1: The First Pass — Marking Selects

For every shot in your project:

1. **Double-click the clip** in the Project Files panel to open it in the Preview.
2. Play through and use the **playhead** to mark candidate in/out points. Note the timecode displayed in the Preview monitor.
3. Open your annotation file and create a stub entry with:
   - `annotation_id` (next in sequence)
   - `source_file.reference_id` (the clip's filename, anonymized)
   - `clip.in_point` and `clip.out_point` (from the Preview timecode)
   - `accepted: null` (stub — not yet finalized)

This two-pass workflow — stub first, finalize second — prevents you from losing annotations if the application crashes or you need to adjust the cut after seeing it in context.

---

## Step 2: Placing Clips and Contextual Judgment

Cut selection in isolation and cut selection in context are different judgments. A take that seemed perfect in the Preview may create a continuity problem when placed next to the preceding clip.

**After placing each clip:**
1. Play the transition into and out of the clip (the 2 seconds on either side).
2. Ask: Does the eyeline match? Does the motion continue naturally? Does the audio energy match?
3. If the answer to any of these is no, this cut may need a different in/out point — adjust the clip handles and update the annotation's `clip.in_point`/`out_point`.
4. Add a sentence to `editorial_notes` about what you checked: "Eyeline checked against preceding clip V1-03; consistent. Motion: subject's hand completes the gesture within the out-point."

**Annotation quality marker:** An `editorial_notes` field that only says "good take" is worth significantly less to a training pipeline than one that explains *why* it's good. The reasoning is training data too.

---

## Step 3: Transitions in OpenShot

OpenShot handles transitions by dragging a transition from the Transitions panel onto the boundary between two clips.

Key differences from Shotcut to annotate correctly:
- OpenShot stores transitions as separate JSON objects in the project file, not as clip overlaps. The transition has its own `start`, `end`, and `type` fields.
- The `duration_frames` in the annotation schema should be computed from the transition's duration in the project file: `frames = (end_frame - start_frame)`.
- OpenShot's transition types use different internal names than the annotation schema enum. Mapping:

| OpenShot Internal Name | Schema `transition.type` value |
|------------------------|-------------------------------|
| `%waterfall%` / fade | `dissolve` |
| `%bar%` wipe | `wipe_left` / `wipe_right` (check direction) |
| `%blinds%` | `wipe_left` |
| Slide | `slide` |
| No transition | `cut` |

Always verify in the Preview before annotating. The name alone is not sufficient — check the visual result.

---

## Step 4: Color Grading in OpenShot

OpenShot's color effects are accessed via **Clip Properties > Effects**. Add them in order; OpenShot applies effects from top to bottom in the properties list.

### Annotating the Color Shift Effect

The Color Shift effect modifies hue rotation, saturation, and brightness. Map to schema fields:
- Saturation slider → `color_grade.saturation` (normalize: OpenShot's 0-100 slider maps to 0.0-2.0 in the schema; 50 = 1.0 = unchanged)
- Brightness slider → closest to `color_grade.gamma.master` (not exact, but use it as the midtone adjustment proxy)

### Annotating the Hue/Saturation Effect

- Hue → `color_grade.hsl_curves.hue_vs_hue` (single shift applied globally; represent as a 7-element array with identical values)
- Saturation → `color_grade.saturation`

### What makes a good color annotation in OpenShot

1. **Apply effects one at a time and annotate each**: If you add both a Brightness/Contrast and a Color Shift, create a separate annotation entry for each (linked by `source_file.reference_id`), or clearly document both in `color_grade`.
2. **Use the waveform scope before committing**: OpenShot has a built-in video preview but no native scopes. Use an external scope (e.g., `QColorMeter`) or export a still frame and check it in GIMP's histogram.
3. **Note the export settings**: `source_file.codec` should reflect the *source*, not the export. Add a note in `editorial_notes` if the export uses a different codec or resolution.

---

## Step 5: Extracting Annotations Programmatically

OpenShot's `.osp` file is plain JSON:

```python
import json

def extract_openshot_clips(osp_path, fps=29.97):
    with open(osp_path) as f:
        project = json.load(f)
    
    clips = []
    for clip in project.get('clips', []):
        in_frame = clip.get('start', 0) * fps  # 'start' in seconds in OSP
        out_frame = clip.get('end', 0) * fps
        clips.append({
            'reference_id': clip.get('file', {}).get('path', 'unknown'),
            'in_seconds': clip.get('start', 0),
            'out_seconds': clip.get('end', 0),
            'position_seconds': clip.get('position', 0),
            'layer': clip.get('layer', 0),
            'effects': [e.get('type') for e in clip.get('effects', [])]
        })
    
    transitions = []
    for t in project.get('effects', []):
        if t.get('type') == 'Transition':
            transitions.append({
                'start_seconds': t.get('start', 0),
                'end_seconds': t.get('end', 0),
                'type': t.get('options', {}).get('transition_name', 'unknown')
            })
    
    return clips, transitions
```

The `fps` is in `project['fps']['num'] / project['fps']['den']`.

---

## Rejection Criteria Quick Reference

| Issue | `rejection_reason` value |
|-------|--------------------------|
| Two takes of the same shot both annotated as accepted | `duplicate_of_existing` |
| In/out points extend into the slate or a color card | `source_quality_too_low` |
| Frame rate mismatch detected (stutter visible in preview) | `frame_rate_mismatch` |
| Color effect values were at defaults (no actual grade applied) | `metadata_incomplete` |
| Export artifact visible (blocking, banding) | `encoder_artifact` |
| Subject is blurred or out of focus in the selected region | `out_of_focus` |
