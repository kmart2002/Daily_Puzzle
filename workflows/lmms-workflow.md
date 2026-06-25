# LMMS Workflow: Creating AI Training Data from Music Projects

LMMS (Linux MultiMedia Studio) is a free, cross-platform DAW that combines a pattern-based sequencer (Beat+Bassline), a piano-roll editor, an instrument plugin host, and an FX mixer — all in one application. Its project format is XML (`.mmp` / `.mmpz`), which can be parsed to extract most annotation fields automatically. This guide covers how to structure LMMS projects to produce annotation-ready training data and how to capture the musical and technical metadata that makes audio AI training data useful.

---

## Why LMMS for AI Training Data

- **MMP XML** exposes: tempo, time signature, all instrument configurations, all note data (pitch, velocity, duration, position), all Beat+Bassline patterns, FX chain plugin names and parameter values.
- **ZynAddSubFX and other built-in synths** have deterministic XML parameter representations — every knob position is captured in the project file.
- **Beat+Bassline editor** generates structured rhythmic pattern data that maps directly to drum pattern classification tasks.
- **Open source, stable**: LMMS versions are semantically versioned and project files are backward/forward compatible within minor versions.

---

## Setup

### Project Template for AI Training

Create a master template project with these pre-configured settings:

1. **Edit > Settings > General**:
   - Sample rate: 44100 Hz (music standard) or 48000 Hz (if destined for video)
   - Buffer size: 512 samples (good balance of latency and CPU headroom during work)
2. **Song Editor**: Use the default 4/4 time signature and set tempo before creating any patterns. Changing tempo after patterns are laid down complicates the bar-to-seconds conversion.
3. **FX Mixer**: Create named buses before adding instruments. Naming them at setup time ensures annotations have meaningful `send_levels[].bus_name` values (e.g., "Drum Bus", "Synth Bus", "Master") rather than auto-generated "FX 1", "FX 2".
4. **Beat+Bassline naming**: Rename each Beat+Bassline pattern immediately (right-click the segment in Song Editor). The name appears in the MMP XML and becomes the `editorial_notes` reference identifier.

---

## Step 1: Laying Out the Song Structure

LMMS's Song Editor shows time on the X-axis and instrument tracks on the Y-axis. Blocks (segments) represent pattern instances.

**For clean annotations:**

1. **One pattern type per Beat+Bassline track**: A "Kick/Snare" pattern and a "Hi-Hat" pattern should be separate B+B tracks, not combined into one. This allows per-stem annotations rather than only full-mix annotations.
2. **Explicit section markers**: LMMS doesn't have native markers, but you can use a muted "annotation" instrument track with single-note blocks to mark section boundaries (Intro, Verse, Chorus, Bridge, Outro). Name each block. This gives you `region.bar_start` / `region.bar_end` reference points.
3. **Record the BPM before doing anything else**: `tempo_bpm` is a required field and you should confirm it is set exactly (not "around 90") before any patterns are created. Changing BPM after placing patterns shifts their positions.

---

## Step 2: Instruments and Synthesis

### Annotating ZynAddSubFX

ZynAddSubFX is LMMS's flagship synthesizer and one of the most powerful open-source synths available. When using it:

1. Save each distinct preset as a named ZynAddSubFX preset file (`.xiz`). Record the preset name in `effects_chain[].key_parameters.preset_name` for the instrument's processing slot.
2. For custom patches (not saved presets), capture the 4-5 most significant parameters: oscillator type, ADSR envelope values, filter type and cutoff, and any modulation routing. These go in `effects_chain[].key_parameters`.
3. The `plugin_name` for ZynAddSubFX entries should be `"ZynAddSubFX"` (exact, matching the LMMS plugin display name).

### Annotating AudioFileProcessor (Samples)

LMMS's AudioFileProcessor plays audio samples with pitch/speed control. For annotations:
- Record the sample file reference in `source_file.reference_id`
- Note interpolation mode (none / linear / sinc) in `key_parameters`
- If the sample is looped, note `loop_start_frame` and `loop_end_frame`

**Copyright check**: Every sample used in an LMMS project must be cleared before it can appear in a training dataset. If the sample has an unclear license, the annotation must be rejected with `rejection_reason: "copyrighted_sample"`. This is a legal requirement, not just a quality standard.

---

## Step 3: The FX Mixer — Building the Effects Chain

LMMS's FX Mixer is where you apply per-channel processing. The signal flow is:
`Instrument → FX Channel → (FX Chain plugins) → Send to Master` 

This maps directly to the `effects_chain` array in the schema.

**For each FX channel you intend to annotate:**

1. Open the FX chain for that channel (click the chain icon in the FX Mixer).
2. List the plugins in order from top to bottom. Slot 1 = top.
3. For each plugin, record:
   - `plugin_name`: The exact display name (e.g., "Calf Compressor", "GVERB", "Magneto2")
   - `plugin_type`: Choose the closest enum value
   - `enabled`: The power button state (green = enabled)
   - `key_parameters`: At minimum, threshold/ratio for compressors; frequency/gain/Q for EQ bands; decay/size for reverb; feedback/delay_ms for delay

**What makes a good FX chain annotation:**
- Every plugin is listed, including ones that are bypassed (with a `bypass_reason`)
- The chain represents a *completed* mix decision, not a work-in-progress
- Key parameters are recorded from the plugin UI, not estimated from memory

**What makes a bad FX chain annotation:**
- Plugin list is incomplete (you forgot the reverb on the send bus)
- `key_parameters` is an empty object `{}` — if you can't recall the settings, re-open the project and check
- The chain was recorded before the mix was balanced — a compressor's threshold only makes sense relative to the input level

---

## Step 4: Mix Levels and LUFS Metering

LMMS does not have a native LUFS meter. To get `mix_levels.integrated_lufs`:

1. Export the final mix or stem to WAV (Song Editor > Export).
2. Run the exported file through `ffmpeg`:
   ```bash
   ffmpeg -i output.wav -af loudnorm=print_format=json -f null /dev/null 2>&1 | grep '"input_i"'
   ```
   The `input_i` value is the integrated LUFS.

3. Alternatively, use `r128gain`:
   ```bash
   r128gain output.wav
   ```

Record this value in `mix_levels.integrated_lufs`. **Target ranges:**
- Streaming (Spotify, Apple Music): -14 LUFS ± 1
- YouTube: -14 LUFS
- Broadcast (EBU R128): -23 LUFS
- CD / download: -9 to -12 LUFS

---

## Step 5: Extracting Annotations from MMP XML

```python
import xml.etree.ElementTree as ET

def extract_lmms_metadata(mmp_path):
    tree = ET.parse(mmp_path)
    root = tree.getroot()
    
    head = root.find('head')
    tempo = float(head.get('bpm', 120))
    time_sig_num = int(head.get('timesig_numerator', 4))
    time_sig_den = int(head.get('timesig_denominator', 4))
    
    tracks = []
    for track in root.iter('track'):
        track_type = track.get('type')
        track_name = track.get('name', 'Unnamed')
        tracks.append({'type': track_type, 'name': track_name})
    
    # FX Mixer plugins
    fx_chains = []
    for fxchan in root.iter('fxchannel'):
        chain = []
        for plugin in fxchan.iter('plugin'):
            chain.append(plugin.get('name', 'unknown'))
        fx_chains.append({'channel': fxchan.get('name'), 'plugins': chain})
    
    return {
        'tempo_bpm': tempo,
        'time_signature': {'numerator': time_sig_num, 'denominator': time_sig_den},
        'tracks': tracks,
        'fx_chains': fx_chains
    }
```

Note: `.mmpz` files are zlib-compressed. Decompress first: `python -c "import zlib,sys; open('out.mmp','wb').write(zlib.decompress(open(sys.argv[1],'rb').read()))" project.mmpz`

---

## What Makes Good vs. Bad Music Training Data

### Good Examples
- Tempo is consistent (no tempo drift unless `tempo_bpm` documents it as intentional)
- Key is set correctly and the melody/harmony confirm it
- Mix is balanced — no single instrument dominates by more than 6-8 dB over the others in the same frequency range
- Effects serve a clear musical purpose documented in `editorial_notes`
- The region covers a complete musical phrase (e.g., full verse, full chorus) — not an arbitrary time slice

### Bad Examples (Rejection Criteria)

| Issue | `rejection_reason` |
|-------|-------------------|
| Clipping on master output (peaks at 0 dBFS) | `clipping_distortion` |
| Tempo in the file differs from `tempo_bpm` annotation | `tempo_inconsistency` |
| Melody notes are in a different key than `key` annotation | `key_mismatch` |
| LMMS project used a sample with unclear license | `copyrighted_sample` |
| Export produced audible render artifact (zipper noise, dropout) | `render_artifact` |
| Duration is less than 4 bars | `duration_too_short` |
| Identical to a previously annotated project | `duplicate_of_existing` |
