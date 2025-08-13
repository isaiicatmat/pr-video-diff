# PR Video Diff 🎬

> A GitHub Action that **records two URLs** (base vs. preview) and generates a **split-screen MP4/GIF** to visualize UI changes in every Pull Request.

---

## 🚀 Quick Start

1. Add this action to your repository (e.g., in `.github/actions/pr-video-diff/`) **or** publish it as a standalone action.
2. Create a workflow file (see example below).
3. Open a PR with a deploy preview (Netlify/Vercel) and check the Job Summary + Artifacts.

> **Note:** The action writes a **thumbnail** directly into the run’s **Job Summary**.

---

## 🛠 Example Workflow

```yaml
name: PR Video Diff

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  video-diff:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
      actions: read

    steps:
      - uses: actions/checkout@v4

      # If the action is in the root of the repo
      - name: Generate visual diff
        uses: ./
        with:
          url_base: 'https://unsplash.com'
          url_preview: 'https://pixabay.com'
          duration_seconds: 8
          viewport_width: 1280
          viewport_height: 720
          steps_json_path: 'scripts/steps.example.json'
          output_format: 'both'
          post_comment: 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: pr-video-diff
          path: pr-video-diff/*

      - name: Comment with run link
        if: github.event_name == 'pull_request'
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body: |
            🎬 **PR Video Diff** ready.
            ▶️ Download from the **Artifacts** section of this run:
            ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}

```


## ⚙️ Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `url_base` | string | — | Base/production URL |
| `url_preview` | string | — | Preview URL |
| `duration_seconds` | number | `8` | Duration of each recording |
| `viewport_width` | number | `1280` | Browser viewport width |
| `viewport_height` | number | `720` | Browser viewport height |
| `steps_json_path` | string | `''` | Path to a JSON file with scripted steps (see below) |
| `output_format` | enum | `both` | `mp4`, `gif` or `both` |
| `gif_fps` | number | `12` | Frames per second for the GIF |
| `post_comment` | boolean | `true` | Post a PR comment with a link to the run |
| `lang` | string | `en` | Reserved for future subtitles support |

## 🧪 Scripted Steps (Optional)

Provide a JSON file with an array under `actions`:

```json
{
  "actions": [
    { "type": "wait", "ms": 1000 },
    { "type": "scroll", "y": 800, "ms": 600 },
    { "type": "click", "selector": "a[href='/buy']" }
  ]
}
```

Supported action types: `wait`, `scroll`, `click`, `type`.

## 🧱 Output files

- `pr-video-diff/base.mp4` — captura de la URL base  
- `pr-video-diff/preview.mp4` — captura de la URL preview  
- `pr-video-diff/pr-video-diff.mp4` — split-screen  
- `pr-video-diff/pr-video-diff.gif` — (opcional) GIF optimizado  
- `pr-video-diff/thumbnail.png` — miniatura para Summary

## ☁️ Optional Hosting

f you upload the MP4/GIF to S3 or Spaces, you can tweak src/index.ts to publish and post a public URL in the PR comment.

## 🔒 Permissions

This workflow requires: `pull-requests: write` and `issues: write` to post PR comments.


## 🧾 License

MIT

