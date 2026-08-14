# Canvas build assets for GHY 417/517

This folder holds everything a browser-console script needs to build out the Canvas course in one shot.

## What's here

- `syllabus.html` — the syllabus body, HTML.
- `python_resources.html` — the Python & Colab Resources page.
- `W1_Overview.html`, `W1_Reading_Guide.html`, `W1_Data_Card_HURDAT2.html`, `W1_Discussion_Prompt_Intro.html`, `W1_Announcement_Monday.html` — Week 1 pages.
- `W2_Overview.html`, `W2_Reading_Guide.html`, `W2_Data_Card_EJScreen.html`, `W2_Discussion_Prompt.html`, `W2_Announcement_Monday.html` — Week 2 pages.
- `W2_Quiz1.zip` — Canvas QTI 1.2 package for the Week 2 reading quiz. Import via Course Settings → Import Course Content.
- `canvas_build.js` — the master build script.

## How to run the build

1. Push this folder to the `mapossum/gsqm` repo (so files are reachable at `https://raw.githubusercontent.com/mapossum/gsqm/main/canvas-assets/...`).
2. Sign in to Canvas at `https://usm.instructure.com/courses/129514`.
3. Open the browser DevTools Console (F12 → Console tab).
4. Paste the entire contents of `canvas_build.js` and press Enter.
5. Watch the log lines — expect ~30 seconds of activity.

The script is safe to re-run — it updates existing items in place rather than duplicating.

## What the script builds

- Syllabus body.
- 6 Assignment Groups with weights (Labs 35, Quizzes 5, Discussions 5, Midterm 15, Final 15, Capstone 25) + weighting enabled.
- Course Resources module (Python & Colab Resources).
- Week 1 module (opens Mon Aug 24 8 am CT): Overview, Reading Guide, Video Lecture placeholder, Data Card, Intro Discussion (due Fri Aug 28), Lab 0 assignment (due Wed Sept 2).
- Week 2 module (opens Mon Aug 31 8 am CT): Overview, Reading Guide, Video Lecture placeholder, Data Card, Discussion (due Fri Sept 4), Lab 1 assignment (due Wed Sept 9).
- 3-dimension Lab Rubric (30 pts) attached to Lab 1.
- Two scheduled Monday announcements (Aug 24 and Aug 31 at 8 am CT).

## What the script does NOT do (manual steps)

1. Import the Week 2 quiz — QTI is at `W2_Quiz1.zip`. Go to Settings → Import Course Content → Content Type: **QTI .zip file** → upload. Then edit the imported quiz: assignment group = Reading Quizzes, available Mon Aug 31 8 am CT, due Tue Sept 8 11:59 pm CT (Labor Day shift), 2 attempts, hard close.
2. Embed video segments into the "Week N Video Lecture" pages after Studio uploads.
3. Add links inside Overview pages pointing to the .pptx and .ipynb files uploaded to Course Files.
4. Publish each module + each module item + the course itself when ready.

## Re-running

If you tweak an HTML file, push the update to GitHub, then re-run the script. It will re-`PUT` the affected page.
