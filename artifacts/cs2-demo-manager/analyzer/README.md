# Local Demo Analyzer

Runs locally only. No demo files are uploaded.

```bash
node analyzer/analyze-demo.js "C:\\path\\to\\match.dem"
```

The analyzer uses pinned `@laihoe/demoparser2@0.41.3` as the stats source and prints one JSON object to stdout.

Release builds bundle a local `node.exe` next to this script. Development can use the system `node` runtime.
