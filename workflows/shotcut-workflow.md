# Shotcut Workflow: Creating AI Training Cuts

Shotcut is an open-source NLE built on the MLT Multimedia Framework. Its native project format is MLT XML — a human-readable, parseable format that makes it ideal for programmatic annotation extraction. This guide covers how to use Shotcut to produce editorial decisions that become high-quality AI training data.

---

## Why Shotcut for AI Training Data

- **MLT XML project files** expose every edit decision as structured data: clip paths, in/out points, timeline positions, filter chains, and transition parameters are all readable without opening the application.
- **Filter system**: Shotcut's filters map cleanly to the `color_grade` and `effects_chain` fields in the annotation schemas.
- **Version stability**: Shotcut's versioning is consistent (`YY.MM.DD`), making it easy to track which version produced which annotation.

---

## Setup

### Recommended Settings for Training Data Production

1. **File > New** — Set timeline resolution and frame rate to match your source footage (do not transcode unless necessary; native editing preserves original metadata).
2. **Settings > Display Method** — Use "OpenGL" for color-accurate monitoring.
3. **Settings > Timeline > Show Audio Waveforms** — Enable. You will use audio peaks to inform cut decisions even on video-only annotations.
4. **Settings > Proxy Editing** — Enable if your source is 4K+ to maintain a responsive editing experience without transcoding the originals.
5. **View > Scopes > Video Waveform** and **Histogram** — Keep these open during color work. The waveform is the ground truth for lift/gamma/gain decisions; the eyeball is not.

---

## Step 1: Ingest and Organize

Before making a single cut:

1. **Import all takes** for the shot into the Playlist. Label each clip with its take number in the Properties panel ("Notes" field).
2. **Review each take in full** before selecting any. Make a mental note (or a text note in an external file) of what distinguishes each take — performance quality, technical issues, continuity with surrounding cuts.
3. **Log rejected takes immediately.** Open the annotation file for this session and add an entry with `accepted: false` and the appropriate `rejection_reason`. Rejected takes that are logged are as valuable as accepted ones because they teach a model what *not* to do.

**What makes a bad training example at this stage:**
- Clip has visible focus pull or rack mid-take (unless the edit type is specifically about focus pulls)
- Audio and video are out of sync by more than 1 frame
- Frame rate or resolution doesn't match the project settings
- Source codec has visible compression artifacts at the selected in/out points

---

## Step 2: Making the Cut — Precision Techniques

### Finding the In-Point

1. Use **I** key to set in-point while playing. Then use **,** and **.** (comma/period) to step one frame back/forward to refine.
2. For dialogue cuts: the in-point should be at least 2 frames before the first syllable begins. Cutting on the exact start of audio creates an audible click in many playback scenarios.
3. For action cuts: cut on the *peak* of the motion, not the beginning. If a character is reaching for a door handle, the cut goes at the moment their hand makes contact — the moment of highest visual tension.
4. Record the SMPTE timecode displayed in the Source Monitor. This goes in `clip.in_point.timecode`.

### Finding the Out-Point

1. Use **O** to mark. Refine with frame stepping.
2. For dialogue: leave at least 1 frame of audio after the last syllable. Cutting on the exact last frame of speech sounds clipped.
3. For action: cut at the beginning of the *next* motion, not at the end of the current one. The outgoing action should complete on screen.

### Recording the Annotation

After the cut is placed on the timeline:
- Note `clip.in_point.seconds` from the Source Monitor timecode (convert from HH:MM:SS:FF using the project frame rate)
- Note `clip.out_point.seconds`
- Note `clip.timeline_position.start_seconds` from the Timeline position indicator
- Compute `clip.duration_seconds = out_point.seconds - in_point.seconds`

---

## Step 3: Transitions

Shotcut supports transitions by overlapping clips on the same track. The overlap duration equals the transition duration in frames.

**What makes a good transition annotation:**
- The `transition.type` is unambiguous — if you used a wipe, specify which direction
- `transition.duration_frames` reflects the actual overlap, not an approximation
- `transition.easing` is set explicitly (Shotcut defaults to linear; if you changed it, record the change)

**Common mistakes that invalidate transition annotations:**
- Logging a transition on a cut (overlap of 0 frames) — this is `transition.type: "cut"`, not a transition
- Logging duration in seconds instead of frames — schemas require frames for this field

---

## Step 4: Color Work in Shotcut

Shotcut applies color filters per-clip. To annotate a color grade:

1. Select the clip on the timeline.
2. Open **Filters > Video > Color Grading** (the three-way color corrector).
3. The three wheels correspond to `color_grade.lift` (shadows), `color_grade.gamma` (midtones), and `color_grade.gain` (highlights).
4. Shotcut expresses these as RGB values in the range [-1, 1] for lift and [0, 4] for gamma/gain. Record the exact values from the filter UI — do not round to the nearest 0.1.

**What makes a good color grade annotation:**
- **Before and after are documented**: Add an editorial note describing the problem you were correcting ("flat log footage with 6300K mixed light source") and what you aimed for ("natural contrast, corrected to 5200K daylight with warm highlight split").
- **Parametric values are exact**, not estimated.
- **LUT usage is declared**: If you applied an LUT via the LUT filter, name it exactly in `color_grade.lut_applied`. An unknown LUT is a rejected annotation.
- **Saturation and contrast adjustments are separate from the wheels**: Shotcut's Color Grading filter has separate saturation and contrast sliders; record these in `color_grade.saturation` and `color_grade.contrast`.

**What makes a bad color grade annotation:**
- The grade is technically correct (histogram in range) but `editorial_notes` is blank — the *intent* is part of the training label
- The before/after frames are not representative (you graded the middle of a clip but the in/out points are a different shot)
- Saturation > 2.0 or < 0.3 without a documented creative reason — extreme values need justification to remain in the positive training set

---

## Step 5: Extracting Annotations from MLT XML

Shotcut's `.mlt` project file is parseable. A minimal Python extractor:

```python
import xml.etree.ElementTree as ET

def extract_clips(mlt_path):
    tree = ET.parse(mlt_path)
    root = tree.getroot()
    clips = []
    for entry in root.iter('entry'):
        producer = entry.get('producer')
        in_frame = int(entry.get('in', 0))
        out_frame = int(entry.get('out', 0))
        clips.append({
            'producer': producer,
            'in_frame': in_frame,
            'out_frame': out_frame,
        })
    return clips
```

The frame rate is in `<profile frame_rate_num="..." frame_rate_den="..."/>`. Convert frames to seconds: `seconds = frame / (frame_rate_num / frame_rate_den)`.

Color filter values are in `<filter id="..."><property name="lift_r">...</property>...</filter>` within each clip's producer block.

---

## Rejection Criteria Quick Reference

| Issue | `rejection_reason` value |
|-------|--------------------------|
| Unintended jump cut from bad trim | `jump_cut_unintentional` |
| Clipping highlights or crushed blacks | `exposure_out_of_range` |
| Motion blur from low shutter speed | `motion_blur_excessive` |
| Audio drifts from video mid-clip | `audio_sync_drift` |
| Color grade inconsistent with surrounding clips | `color_inconsistency` |
| Same clip already annotated | `duplicate_of_existing` |
| Source below 720p or heavy compression artifacts | `source_quality_too_low` |
