# Ardour Workflow: Creating AI Training Data from DAW Sessions

Ardour is a professional-grade digital audio workstation used in broadcast, film post-production, and music recording. Unlike the other tools in this pipeline, Ardour is the industry choice for demanding multi-track audio work: it supports non-destructive region-based editing, LV2/VST plugin chains, automation lanes with sub-sample precision, and session formats designed for long-term archiving. Its native session format is XML, which exposes every routing decision, plugin chain, region edit, and automation event as parseable data.

This guide focuses on Ardour's primary use case in this pipeline: voice recording, podcast production, and narration editing — the track types where Ardour's precision and non-destructive workflow produce the highest-quality training annotations.

---

## Why Ardour for AI Training Data

- **Non-destructive region editing**: Every cut, trim, and crossfade is stored as a *region operation*, not a destructive file modification. This means the annotation can reference the original audio file and the edit sequence separately — ideal for sequence-to-sequence training (what operations did the editor perform to go from raw recording to clean edit?).
- **Session XML**: The `.ardour` session file contains the full graph of tracks, buses, plugins, automation, region positions, and crossfades. A single XML file is the complete training record.
- **LV2 plugin ecosystem on Linux**: The LSP and Calf plugin suites provide professional-grade processing with consistent parameter names across projects. This makes cross-project parameter comparison meaningful.
- **Accurate loudness tools**: Ardour integrates with `ebumeter` and supports R128 loudness normalization natively in export.

---

## Setup

### Session Configuration for Training Data

1. **Session > New Session**:
   - Set sample rate to 48000 Hz for voice/podcast work (broadcast standard)
   - Bit depth: 32-bit float for internal processing (reduces rounding errors during plugin processing); record at 24-bit
   - Timecode: Set to 30 fps drop-frame if the audio is destined for video; 30 fps non-drop for standalone audio

2. **Track naming convention**: Name each track with its content type and take number before recording. Example: `Host-Mic-01`, `Guest-Mic-01`, `Room-Tone-01`. These names will appear in the session XML and become the basis for per-track annotation IDs.

3. **Bus routing**: Create your bus structure before recording:
   - `Voice Bus` — receives all microphone tracks
   - `Ambience Bus` — receives room tone and SFX
   - `Master` — receives Voice Bus and Ambience Bus
   
   Document this routing in the `mix_levels.send_levels` fields of each track annotation.

4. **Enable the transport master** and record with a pre-roll of at least 2 seconds. The pre-roll gives the performer time to settle into their natural speaking energy, and it gives you room tone at the top of each take for the noise floor reference.

---

## Step 1: Recording and Take Management

### During Recording

1. **Record all takes without stopping to listen back.** Judgment interrupts performance. Capture everything, then annotate.
2. **Mark problem regions in real time**: Ardour supports **markers** (hit **\`** during recording to drop a marker). Use this to flag: plosives (`P`), breath-over-silence issues (`B`), technical noise (`N`), and retake cues (`RT`).
3. After the session: rename markers with descriptive labels. These become the seed data for `noise_events` annotations.

### Take Organization

Each complete take of a segment gets its own region in Ardour. Use **Region > Duplicate** sparingly — duplicated regions share the underlying audio file, which can cause annotation confusion if one instance is edited and the other is not.

**Annotation rule**: Each take → one `annotation_id`. If take 2 replaces take 1 for a segment, create an annotation for take 1 with `accepted: false` and `rejection_reason: "annotator_error"` (or the appropriate technical reason), and a separate annotation for take 2 as the accepted version.

---

## Step 2: Editing — The Three-Pass Method

Ardour's non-destructive editing supports a clean three-pass approach that produces well-organized annotations:

### Pass 1: Structural Editing (Regions)

Remove the obviously unusable material:
- Pre-roll silence (usually the first 2 seconds)
- Post-roll (after the last word)
- False starts (before the speaker settles)
- Off-topic tangents (agreed with client in advance)

Use Ardour's **Range mode** (R key) to select and delete. Every deletion is a region operation — non-destructive. Record the final `region.start_seconds` and `region.end_seconds` from the Ardour timeline after pass 1.

### Pass 2: Problem Identification (Noise Events)

Listen through the edited region at moderate volume (not through monitors, through headphones — you'll catch more). For each problem:
1. Place a marker at the problem location.
2. Classify the problem type (from the `noise_events[].noise_type` enum).
3. Decide on the action:
   - Minor breath between words: `reduced` (draw volume automation down)
   - Click/pop: `removed` (cut around it or use spectral repair if available)
   - Clipping: Assess severity — if moderate, try de-clipping; if severe, `region_deleted`
   - Extended noise: `replaced_with_room_tone` (paste room tone from the pre-roll recording)

All problem events and their actions become `noise_events` entries in the annotation.

### Pass 3: Processing (Plugin Chain)

Add plugins to the track's processor list in this order (top to bottom in Ardour's mixer strip):

1. **High-pass filter** (LSP High Pass Filter): Remove sub-bass rumble. For voice: 80-120 Hz. For room mic: 40-60 Hz.
2. **Parametric EQ** (LSP Parametric EQ): Tonal shaping. Common adjustments:
   - Cut 200-300 Hz: reduces boxy room sound
   - Boost 2-4 kHz: adds presence and intelligibility
   - Boost 8-12 kHz: adds "air" (use carefully with condenser mics — can increase sibilance)
3. **De-esser** (LSP De-esser): Controls sibilance. Set detection frequency to the speaker's sibilance peak (usually 6-9 kHz for female voices, 5-8 kHz for male). Set threshold so it catches only the loudest S sounds, not all consonants.
4. **Compressor** (Calf Compressor or LSP Compressor): Dynamic range control. For podcast voice: threshold -20 to -25 dBFS, ratio 3:1 to 4:1, attack 5-15 ms, release 100-200 ms. Makeup gain to restore level.
5. **Noise Gate** (LSP Noise Gate): Silences the track between words. Set threshold just below the noise floor of the room. Too high and it clips the ends of words; too low and it passes noise through.
6. **Limiter** (LSP Limiter): Catch any remaining peaks. Set at -3 dBFS for podcast delivery.

For each plugin in the chain: record name, type, enabled state, and key parameters in the `effects_chain` array.

---

## Step 3: Automation

Ardour's automation lanes record volume, pan, and plugin parameter changes over time. If you used volume automation to duck a breath noise or ride a quiet section up, this is an editorial decision worth capturing.

In the annotation schema, volume automation is captured implicitly through `noise_events[].action: "reduced"` — the automation is the implementation of the decision, but the decision is the training-relevant unit. If you used automation for musical or creative dynamics (not just problem fixing), note it in `editorial_notes`.

---

## Step 4: Export and Loudness Measurement

1. **Session > Export > Export to File** — choose WAV, 24-bit, 48000 Hz for the final delivery file.
2. In the export dialog, enable **Normalize** and select **Loudness Normalization (EBU R128)**.
3. Target: -16 LUFS for podcast, -23 LUFS for broadcast, -14 LUFS for streaming.
4. After export, verify with ffmpeg:
   ```bash
   ffmpeg -i final_export.wav -af ebur128=framelog=verbose -f null /dev/null 2>&1 | grep "Integrated"
   ```
5. Record the `I:` value in `mix_levels.integrated_lufs`.
6. Record the peak value in `mix_levels.peak_db`.

---

## Step 5: Extracting Annotations from Session XML

```python
import xml.etree.ElementTree as ET

def extract_ardour_session(ardour_path):
    tree = ET.parse(ardour_path)
    root = tree.getroot()
    
    # Session metadata
    sample_rate = int(root.get('sample-rate', 48000))
    
    routes = []
    for route in root.iter('Route'):
        if route.get('default-type') == 'audio':
            name = route.get('name', 'Unknown')
            processors = []
            for proc in route.iter('Processor'):
                plugin_type = proc.get('type', 'unknown')
                plugin_name = proc.get('name', 'unknown')
                active = proc.get('active', '1') == '1'
                processors.append({
                    'name': plugin_name,
                    'type': plugin_type,
                    'enabled': active
                })
            routes.append({'name': name, 'processors': processors})
    
    # Regions
    regions = []
    for region in root.iter('Region'):
        start_sample = int(region.get('start', 0))
        length_sample = int(region.get('length', 0))
        regions.append({
            'name': region.get('name', 'Unknown'),
            'start_seconds': start_sample / sample_rate,
            'end_seconds': (start_sample + length_sample) / sample_rate,
            'muted': region.get('muted', '0') == '1'
        })
    
    return {'sample_rate': sample_rate, 'routes': routes, 'regions': regions}
```

---

## Rejection Criteria Quick Reference

| Issue | `rejection_reason` |
|-------|-------------------|
| Output waveform is clipped / flat-topped | `clipping_distortion` |
| Noise floor audible above -60 dBFS | `noise_floor_too_high` |
| Stereo image collapses when summed to mono | `phase_cancellation` |
| Sample rate mismatch between source and session | `sample_rate_mismatch` |
| Duration of annotated region is under 30 seconds | `duration_too_short` |
| Session used a commercial sample or music bed not cleared | `copyrighted_sample` |
| Plugin chain corrupted (crash recovery, version incompatibility) | `effects_chain_corrupted` |
| Required fields missing from annotation at commit time | `metadata_incomplete` |
