# v0.2.0 stabilization gate

Upstream comparison base: a-ghorbani/pocketpal-ai@5a27b5f97d3d6b999083ade4a58caad45658f4dc.
Last passing internal CI: e15ba66d89be9b6e93b18722e4704ed7fed2627a, run 45852527590. Subsequent changes require re-verification.

Freeze feature expansion. Compare inherited behavior against pinned upstream, not moving main. Preserve local data and offline behavior.

| Area | Required functional gate | Status |
|---|---|---|
| Chat and model lifecycle | Load, stream, cancel, reload, switch, restart | Partial device evidence |
| Backend selection | CPU zero offload; OpenCL and HTP distinct; report actual offload | Pending |
| Voice | ASR accuracy, echo, VAD, TTS latency and interruption | Device defects reported |
| Vision | Incompatible model does not trap UI; compatible image inference | Pending |
| Assistants | Switch without losing chat; correct persona | Pending |
| Theme | Dark/light composer and dialogs | Device defects reported |
| Memory | CRUD, indexed retrieval, backup, disputes, native upgrade recovery | Mock tests passed; native upgrade pending |
| Reasoning | Simple and complex prompts, cancellation, mode indication | Unit tests passed; functional pending |
| Build | Typecheck, tests, dual ABI, metadata, payload, emulator | Passed at above revision |

Do not label stable until required gates pass. Physical GPU/NPU, microphone and thermal behavior require device testing. No public release until approved.
