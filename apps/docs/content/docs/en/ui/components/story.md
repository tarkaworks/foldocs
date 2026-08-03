---
title: Story
description: Present component variants in an accessible persistent playground.
---

# Story

```mdx
<Story id="button" persist="true">
  <StoryVariant title="Default" value="default">
    <DemoButton />
  </StoryVariant>
  <StoryVariant title="Disabled" value="disabled">
    <DemoButton state="disabled" />
  </StoryVariant>
</Story>
```

Variants use the same selected-tab model as normal `Tabs`, including persistent
selection. `StoryControl` can display the active properties next to a preview.
Interactive demos remain registered Foldkit components, so they use typed model,
message, update, and view boundaries.
