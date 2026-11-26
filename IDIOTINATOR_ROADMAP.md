# Idiotinator — development roadmap
Local-first, account-free assistant based on PocketPal AI (MIT); retain upstream attribution and reliable engineering. Replaceable models, permanent memory, evolving personality. Milestones are targets, not claims of implementation.

## Stage 1
- 0.1.4: tested offline inference.
- 0.1.5: partially tested independent identity.
- 0.1.6 (current): original UI, model library repair, remove commercial/cloud dependencies and branding, AI Studio, personality presets/sliders, verified runtime identity injection across chat paths, categorized settings, math/code rendering, preserve models/chats.
- 0.1.7: ARM64-first Poco F5 optimization; optional x86_64 emulator; CPU/GPU/accelerator detection, investigate OpenCL, thread/context tuning, RAM/thermal safeguards, live monitoring, adaptive reasoning, model recommendations, independent storage, Stable/Advanced/Experimental profiles, performance lab.

## Stage 2
- 0.2.0: model-independent persistent memory, real-time corrective learning, preference learning, extraction/retrieval, source/confidence/contradiction tracking, editable/deletable/exportable memory, adaptive personality; never treat unverified generated claims as facts.
- 0.2.1: manual/automatic web search, deep research, citations, multi-source verification, local knowledge library, RAG, freshness tracking.
- 0.2.2: procedural/experiential learning, successful methods and tool workflows, error memory, feedback, task decomposition, strategy evaluation.
- 0.2.3: opt-in background consolidation while idle/charging/cool; deduplication, summaries, conflict review, retrieval optimization and quality checks.
- 0.2.5: modular skills, calculator, sandboxed code, alarms/timers/reminders, notes, SMS/email drafts, authorized Android actions/routines, permissions, audit and emergency stop.

## Stage 3
- 0.3.0: adaptive Council, model routing, single-model reflection, sequential and optional parallel reasoning, independent critique, disagreement handling, uncertainty and tool verification; compare quality/cost against single model. Candidate models Qwen3.5 4B/9B, Gemma 4 E4B, LFM3 1.7B subject to availability, compatibility and benchmarks.
- 0.3.5: PDF/TXT/CSV/code analysis, document comparison and RAG, project workspaces with separate files, instructions, memory and progress.
- 0.3.8: offline phone, local PC and optional authorized external backends; unified identity, local-first memory and privacy.

## Stage 4
- 0.4.0: vision, camera/video, OCR, scanned PDF, technical drawings, permissioned screen awareness.
- 0.4.5: offline ASR/TTS, VAD, full duplex where supported, wake word, personality-aware voice, multilingual support, Android assistant integration, floating assistant, proactive reminders, authorized background research, briefings and notifications.

## Stage 5
- 0.5.0: experimental continual neural adaptation via separate training backend, small-model LoRA first, verified training examples, optional PC training, frozen base weights, adapter versioning/import/export, held-out evaluation, forgetting mitigation, reject degraded adapters and rollback. On-device feasibility not guaranteed.

## Stage 6
- 0.6.0: wider Snapdragon/MediaTek/Exynos/Tensor compatibility, low-RAM profiles, backend detection and CPU fallback.

## Stage 7
- 0.9.0: integration/security audit, encrypted memory, network monitor/offline lock, permission controls, crash recovery, rollback, battery/thermal optimization, backup/restore, compatibility and regression tests, remove obsolete dependencies.
- 1.0.0: stable integrated assistant.

## Release gates
Keep security, privacy and resource safeguards throughout development, not only at final audit. No mandatory accounts/cloud. Preserve user data and model files across updates. Verify build, device launch, offline inference and regressions before marking milestones complete. Do not expose unimplemented features as working. Pause for user confirmation at stage boundaries. Experimental features must be opt-in and reversible.
