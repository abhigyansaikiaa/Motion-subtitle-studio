# Behind Subject

Typography exists in the physical depth of the video.

Correct conceptual order:
background video → behind-text → subject matte → optional foreground text

Some words can sit behind the person while others remain in front.

This requires actual segmentation/matting. Z-index alone is not a valid implementation. Preserve hair, head, shoulders, movement, and edges as well as possible. If segmentation fails, safely fall back instead of showing a broken/black frame.