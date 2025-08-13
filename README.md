# PR Video Diff 🎬

> A GitHub Action that **records two URLs** (base vs. preview) and generates a **split-screen MP4/GIF** to visualize UI changes in every Pull Request.

---

## 🚀 Quick Start

1. Add this action to your repository (e.g., in `.github/actions/pr-video-diff/`) **or** publish it as a standalone action.
2. Create a workflow file (see example below).
3. Open a PR with a deploy preview (Netlify/Vercel) and check the Job Summary + Artifacts.

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
