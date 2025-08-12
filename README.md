# PR Video Diff (Starter)

> Acción de GitHub que **graba dos URLs** (base vs. preview) y genera un **split‑screen MP4/GIF** para revisar cambios de UI en cada PR.

## 🚀 Uso rápido

1. Copia este repositorio dentro de tu repo (como carpeta `.github/actions/pr-video-diff/`) **o** publícalo como acción independiente.
2. Crea un workflow (ejemplo abajo).
3. Abre un PR con un deploy preview (Netlify/Vercel) y revisa el Job Summary + Artifacts.

### Ejemplo de workflow

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

      # Si copiaste la acción en .github/actions/pr-video-diff
      - name: Generate visual diff
        uses: ./.github/actions/pr-video-diff
        with:
          url_base: 'https://tu-sitio.com'
          url_preview: ${{ steps.deploy_preview.outputs.url || 'https://preview.example.com' }}
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
            🎬 **PR Video Diff** listo.
            ▶️ Descárgalo en la sección **Artifacts** de este run:
            ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

> **Nota:** La acción escribe un **thumbnail** directamente en el **Job Summary** del run.

## ⚙️ Inputs

| Nombre | Tipo | Default | Descripción |
|---|---|---|---|
| `url_base` | string | — | URL de producción/base |
| `url_preview` | string | — | URL de preview |
| `duration_seconds` | number | `8` | Duración de cada grabación |
| `viewport_width` | number | `1280` | Ancho viewport |
| `viewport_height` | number | `720` | Alto viewport |
| `steps_json_path` | string | `''` | Ruta a JSON de pasos (ver abajo) |
| `output_format` | enum | `both` | `mp4`, `gif` o `both` |
| `gif_fps` | number | `12` | FPS del GIF |
| `post_comment` | boolean | `true` | Comenta en el PR con enlace al run |
| `lang` | string | `en` | Reservado para subtítulos |

## 🧪 Pasos automatizados (opcional)

Archivo JSON con un array en `actions`:

```json
{
  "actions": [
    { "type": "wait", "ms": 1000 },
    { "type": "scroll", "y": 800, "ms": 600 },
    { "type": "click", "selector": "a[href='/buy']" }
  ]
}
```

Tipos soportados: `wait`, `scroll`, `click`, `type`.

## 🧱 Qué genera

- `pr-video-diff/base.mp4` — captura de la URL base  
- `pr-video-diff/preview.mp4` — captura de la URL preview  
- `pr-video-diff/pr-video-diff.mp4` — split-screen  
- `pr-video-diff/pr-video-diff.gif` — (opcional) GIF optimizado  
- `pr-video-diff/thumbnail.png` — miniatura para Summary

## ☁️ Hosting opcional

Si subes el MP4/GIF a S3/Spaces, puedes editar `src/index.ts` para publicar y comentar con URL pública.

## 🔒 Permisos

El workflow requiere `pull-requests: write` e `issues: write` para comentar en el PR.

## 🧾 Licencia

MIT
