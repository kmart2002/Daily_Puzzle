# Audio Sample Annotations

This directory contains filled-out example annotations conforming to `schemas/audio-edit-annotation.json`. Each annotation documents a single audio editing or mixing decision in enough detail for an AI model to learn from it.

---

## What Each Field Means for AI Training

### Track Type as Classification Label

`track_type` is the primary label for most audio classification tasks. The 14-value enum spans the full range of audio content an editor encounters: full music mixes, individual stems, spoken word, sound design, and room tone. Models trained on this data can learn to:

- Identify what type of audio content they are processing
- Apply appropriate processing based on content type (dialogue vs. music requires very different EQ curves)
- Distinguish creative choices from technical corrections

### Musical Metadata

`tempo_bpm`, `key`, and `time_signature` form the musical DNA of any annotation. For music-generating or music-understanding models these are required context. For spoken-word and SFX annotations, `key` is set to `not_applicable` and `tempo_bpm` to 0 — this explicit null-signaling is more useful than simply omitting the field because it confirms the annotator actively considered and rejected the fields.

### Region Geometry

The `region` object defines the time window in the DAW session that this annotation covers. Both `seconds` (for numeric computation) and `bar_start`/`bar_end` (for music-structure-aware models) are provided. A model learning music arrangement needs bar-level resolution; a model learning voice editing works in seconds.

### Effects Chain

The `effects_chain` array is the most information-dense part of the schema. Each element represents one plugin in the signal chain, in order from input to output. Key design decisions:

- **Ordered array, not a map**: Signal chain order matters. A compressor before a reverb produces a very different result than a reverb before a compressor. The `slot` field makes the order unambiguous even if the array is shuffled.
- **`plugin_type` enum**: Normalizes across different plugin names (e.g., "Calf Compressor" and "LSP Compressor" both map to `compressor`). This lets models learn the function of a processing stage regardless of which specific plugin was used.
- **`key_parameters`**: Free-form object (within a type constraint) so that any plugin's most important parameters can be captured without requiring a separate schema for every plugin on earth. The annotation author should include the 3-5 parameters that most characterize the sound of the plugin.
- **`enabled`**: A bypassed plugin is still worth capturing because the *intent* (what problem the editor identified) is training-relevant even if the plugin was ultimately turned off.

### Mix Levels

`fader_db` and `pan` are the fundamental two-dimensional position of each track in the mix. These are the outputs a mix prediction model needs to produce. `integrated_lufs` provides a loudness-normalized summary useful for compliance checking and for training loudness normalization models.

### Noise Events

The `noise_events` array captures a sequence-to-sequence mapping: for each identified problem in the source, what action was taken? This data is essential for training audio restoration models that need to learn both problem detection *and* remediation strategies.

### Quality and Acceptance

Same philosophy as video: `quality_rating` ≥ 3 is required for `accepted: true`. The audio rejection vocabulary covers the most common audio-specific failure modes: clipping/distortion, phase cancellation (particularly dangerous in stereo-to-mono summing), tempo/key mismatch in music projects, and render artifacts from DAW export issues.

---

## Files in This Directory

| File | Track Type | Tool | BPM | Key | Rating | Accepted |
|------|-----------|------|-----|-----|--------|----------|
| `example-001.json` | music_full_mix | LMMS 1.2.2 | 92 | A_minor | 4 | true |
| `example-002.json` | voice_podcast | Ardour 8.1.0 | 0 | not_applicable | 4 | true |

---

## Adding New Samples

1. Copy the closest existing example.
2. Use the next sequential `AUD-YYYYMMDD-NNNN` ID.
3. For non-musical content, set `tempo_bpm: 0`, `key: "not_applicable"`, `time_signature: {"numerator": 0, "denominator": 0}`.
4. Include at least 2 items in `effects_chain` for music and at least 1 for voice/SFX.
5. Validate: `python -c "import json,jsonschema; jsonschema.validate(json.load(open('your-file.json')), json.load(open('../../schemas/audio-edit-annotation.json'))); print('OK')"`
