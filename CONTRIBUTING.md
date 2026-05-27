# Adding a memory to the T812 archive

Anyone in the flat can add to this. It takes about a minute.

## The idea

The archive lives in the `archive/` folder. Each subfolder is a **collection**
(e.g. `polaroids/`, `letters/`). To add a memory you drop a scan into the right
folder, optionally describe it in a tiny text file next to it, and commit.

## Steps

1. **Scan your photo / letter.** Save it as a normal image — `.jpg`, `.png`,
   `.webp` are all fine (PDFs work too for documents). Give it a short,
   descriptive, lowercase filename with dashes instead of spaces, e.g.
   `rooftop-summer-2024.jpg`.

2. **Drop it in the right collection** inside `archive/`:
   - Polaroids → `archive/polaroids/`
   - Letters → `archive/letters/`
   - Something new? Just make a new folder under `archive/` — it becomes a new
     collection automatically. (Optionally add a `_collection.txt` in it; see below.)

3. **(Optional but lovely) Describe it.** Make a text file with the *same name*
   but a `.txt` ending, next to your scan:

   `archive/polaroids/rooftop-summer-2024.txt`
   ```
   title: Rooftop summer
   date: 2024-07
   by: Valerio
   caption: The whole flat on the rooftop the night it finally got warm.
   tags: rooftop, summer, party
   ```
   Every line is optional. `date` can be `2024`, `2024-07`, or `2024-07-15`.
   `tags` are comma-separated. If you skip the file entirely, the filename
   becomes the title.

4. **Save it to the archive.** Commit and push (or open a Pull Request if you'd
   like someone to glance at it first):
   ```
   git add archive/
   git commit -m "Add rooftop summer polaroid"
   git push
   ```

That's it. The gallery updates itself — the `manifest.json` index is rebuilt
automatically when you push (see `.github/workflows/pages.yml`).

## Describing a whole collection (optional)

Drop a `_collection.txt` inside a collection folder to give it a nice name:
```
title: The Polaroid Wall
emoji: 📸
description: Every Polaroid pinned to the flat wall, scanned and kept forever.
```

## Previewing locally (optional)

```
python3 scripts/build_manifest.py     # rebuild the index
python3 -m http.server                # then open http://localhost:8000
```
Open it via this little server rather than double-clicking `index.html`, so the
browser is allowed to load `manifest.json`.
