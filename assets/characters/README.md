# Character sprites

FocusBuddy draws its characters in code so the app works with no image files.

## Replace the generated character

1. Export transparent PNG frames into this folder:

```
assets/characters/<character-id>/<pose>/0.png
assets/characters/<character-id>/<pose>/1.png
```

Poses: `idle`, `walk`, `drink`, `stretch`, `wave`, `jump`, `sit`, `think`, `happy`, `sleep`.

2. Open `src/character.js`.
3. On that character, set `source` to `"files"`.
4. Add a `fileFrames` map pointing at those PNGs.

The Customize preview and the desktop companion both render through `renderSprite()`, so you do not need to change the animation timing, reminders, or window code.

Generated characters stay available for any character whose `source` is still `"generated"`.
