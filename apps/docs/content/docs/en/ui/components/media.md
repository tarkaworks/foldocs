---
title: Media
description: Embed accessible video, audio, and sandboxed external media.
---

# Media

```mdx
<Video src="/demo.mp4" poster="/demo-poster.webp" title="Product demo" />
<Audio src="/release-notes.mp3" />
<Embed
  src="https://www.youtube-nocookie.com/embed/example"
  title="Walkthrough"
/>
```

Video and audio use native controls and metadata preloading. External embeds must
use HTTPS and are lazy-loaded inside a restricted sandbox. Authors can narrow or
extend the sandbox explicitly when an integration requires it.
