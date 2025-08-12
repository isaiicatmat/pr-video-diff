import { chromium, Browser, Page } from 'playwright';
import { execa } from 'execa';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

type Step =
  | { type: 'wait'; ms: number }
  | { type: 'scroll'; y: number; ms?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string; delay?: number };

async function main() {
  const inputs = getInputs();
  const workspace = process.env['GITHUB_WORKSPACE'] || '/github/workspace';
  const outDir = path.join(workspace, 'pr-video-diff');
  await fsp.mkdir(outDir, { recursive: true });

  log(`🎬 Iniciando captura...`);
  const baseMp4 = await recordUrlToMp4(inputs.urlBase, 'base', inputs, outDir);
  const previewMp4 = await recordUrlToMp4(inputs.urlPreview, 'preview', inputs, outDir);

  log(`🧩 Componiendo split-screen...`);
  const outMp4 = path.join(outDir, 'pr-video-diff.mp4');
  await composeSplit(baseMp4, previewMp4, outMp4);

  let outGif = '';
  if (inputs.outputFormat === 'gif' || inputs.outputFormat === 'both') {
    log(`🖼️ Generando GIF optimizado...`);
    outGif = path.join(outDir, 'pr-video-diff.gif');
    await mp4ToGif(outMp4, outGif, inputs.gifFps);
  }

  log(`🖼️ Generando thumbnail...`);
  const thumb = path.join(outDir, 'thumbnail.png');
  await makeThumbnail(outMp4, thumb, 800);

  // Salida al Job Summary con miniatura embebida
  await appendSummary(thumb);

  // Outputs
  await setOutput('video_path', outMp4);
  if (outGif) await setOutput('gif_path', outGif);
  await setOutput('thumbnail_path', thumb);

  // Comentario en PR opcional
  let commentUrl = '';
  if (inputs.postComment && process.env['GITHUB_EVENT_NAME'] === 'pull_request') {
    try {
      commentUrl = await commentOnPR();
      if (commentUrl) await setOutput('comment_url', commentUrl);
    } catch (e) {
      log(`⚠️ No se pudo comentar en el PR: ${(e as Error).message}`);
    }
  }

  log(`✅ Listo. Archivos en: ${outDir}`);
}

function getInputs() {
  function env(name: string, req = false, def = ''): string {
    const v = process.env[name] || '';
    if (req && !v) throw new Error(`Falta input: ${name}`);
    return v || def;
  }
  const inputs = {
    urlBase: env('INPUT_URL_BASE', true),
    urlPreview: env('INPUT_URL_PREVIEW', true),
    duration: parseInt(env('INPUT_DURATION_SECONDS', false, '8'), 10),
    viewportWidth: parseInt(env('INPUT_VIEWPORT_WIDTH', false, '1280'), 10),
    viewportHeight: parseInt(env('INPUT_VIEWPORT_HEIGHT', false, '720'), 10),
    stepsJsonPath: env('INPUT_STEPS_JSON_PATH', false, ''),
    outputFormat: env('INPUT_OUTPUT_FORMAT', false, 'both') as 'mp4'|'gif'|'both',
    gifFps: parseInt(env('INPUT_GIF_FPS', false, '12'), 10),
    postComment: (env('INPUT_POST_COMMENT', false, 'true').toLowerCase() === 'true'),
    lang: env('INPUT_LANG', false, 'en'),
  };
  return inputs;
}

async function recordUrlToMp4(url: string, tag: string, inputs: ReturnType<typeof getInputs>, outDir: string) {
  const videoDir = path.join(outDir, `video-${tag}`);
  await fsp.mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: inputs.viewportWidth, height: inputs.viewportHeight },
    recordVideo: { dir: videoDir, size: { width: inputs.viewportWidth, height: inputs.viewportHeight } }
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 45000 });

    // Ejecutar pasos si hay script
    const steps = await loadSteps(inputs.stepsJsonPath);
    if (steps.length) {
      await runSteps(page, steps);
    } else {
      // Scroll suave (fallback)
      await smoothScroll(page, inputs.duration);
    }

    // Asegura duración mínima
    await page.waitForTimeout(Math.max(0, inputs.duration * 1000 - 1000));
  } finally {
    // Guardar video
    const vid = page.video();
    await page.close();
    const webmPath = vid ? await vid.path() : '';
    await context.close();
    await browser.close();

    if (!webmPath) throw new Error('No se generó video .webm');
    const mp4Path = path.join(outDir, `${tag}.mp4`);
    await convertToMp4(webmPath, mp4Path);
    return mp4Path;
  }
}

async function runSteps(page: Page, steps: Step[]) {
  const t0 = Date.now();
  for (const s of steps) {
    if (s.type === 'wait') {
      await page.waitForTimeout(s.ms);
    } else if (s.type === 'scroll') {
      await page.evaluate(([y]) => window.scrollBy({ top: y, behavior: 'smooth' }), [s.y]);
      if (s.ms) await page.waitForTimeout(s.ms);
    } else if (s.type === 'click') {
      await page.click(s.selector, { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    } else if (s.type === 'type') {
      await page.fill(s.selector, '');
      await page.type(s.selector, s.text, { delay: s.delay ?? 50 });
    }
  }
  const spent = Date.now() - t0;
  // Si los pasos fueron muy rápidos, espera un poco para que el clip no quede muy corto
  if (spent < 2000) await page.waitForTimeout(2000 - spent);
}

async function smoothScroll(page: Page, durationSeconds: number) {
  const total = durationSeconds * 1000;
  const steps = Math.max(1, Math.floor(total / 700));
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(600);
  }
}

async function convertToMp4(webm: string, mp4: string) {
  await execa('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
}

async function composeSplit(leftMp4: string, rightMp4: string, outMp4: string) {
  // Normaliza duración a la más corta para evitar frames vacíos
  await execa('ffmpeg', [
    '-y',
    '-i', leftMp4,
    '-i', rightMp4,
    '-filter_complex',
    "[0:v]setpts=PTS-STARTPTS,scale=iw:ih[left];[1:v]setpts=PTS-STARTPTS,scale=iw:ih[right];[left][right]hstack=inputs=2[outv]",
    '-map', '[outv]',
    '-an',
    '-r', '30',
    outMp4
  ], { stdio: 'inherit' });
}

async function mp4ToGif(mp4: string, gif: string, fps: number) {
  const palette = path.join(path.dirname(gif), 'palette.png');
  // Genera paleta
  await execa('ffmpeg', ['-y', '-i', mp4, '-vf', `fps=${fps},scale=900:-1:flags=lanczos,palettegen`, palette], { stdio: 'inherit' });
  // Aplica paleta
  await execa('ffmpeg', ['-y', '-i', mp4, '-i', palette, '-lavfi', `fps=${fps},scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse`, gif], { stdio: 'inherit' });
}

async function makeThumbnail(mp4: string, png: string, width: number) {
  await execa('ffmpeg', ['-y', '-ss', '00:00:01', '-i', mp4, '-frames:v', '1', '-vf', `scale=${width}:-1`, png], { stdio: 'inherit' });
}

async function loadSteps(p: string): Promise<Step[]> {
  if (!p) return [];
  const exists = fs.existsSync(p);
  if (!exists) return [];
  const raw = await fsp.readFile(p, 'utf-8');
  const json = JSON.parse(raw);
  const steps = Array.isArray(json.actions) ? json.actions : [];
  return steps as Step[];
}

async function appendSummary(thumbnailPath: string) {
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (!summaryFile) return;
  const buf = await fsp.readFile(thumbnailPath);
  const b64 = buf.toString('base64');
  const runUrl = `${process.env['GITHUB_SERVER_URL']}/${process.env['GITHUB_REPOSITORY']}/actions/runs/${process.env['GITHUB_RUN_ID']}`;
  const md = [
    `## 🎬 PR Video Diff`,
    ``,
    `![thumbnail](data:image/png;base64,${b64})`,
    ``,
    `**Run:** ${runUrl}`,
    `Descarga el video/gif desde **Artifacts**.`
  ].join('\n');
  await fsp.appendFile(summaryFile, md + '\n');
}

async function setOutput(name: string, value: string) {
  const out = process.env['GITHUB_OUTPUT'];
  if (!out) return;
  await fsp.appendFile(out, `${name}<<EOF\n${value}\nEOF\n`);
}

async function commentOnPR(): Promise<string> {
  const token = process.env['GITHUB_TOKEN'] || '';
  if (!token) throw new Error('GITHUB_TOKEN no disponible');
  const eventPath = process.env['GITHUB_EVENT_PATH'];
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH no disponible');
  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
  const pr = payload.pull_request;
  if (!pr) throw new Error('No es un evento de pull_request');

  const [owner, repo] = (process.env['GITHUB_REPOSITORY'] || '').split('/');
  const runUrl = `${process.env['GITHUB_SERVER_URL']}/${process.env['GITHUB_REPOSITORY']}/actions/runs/${process.env['GITHUB_RUN_ID']}`;

  // Carga perezosa del Octokit (ESM dinámico)
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: token });

  const body = [
    `🎬 **PR Video Diff** listo.`,
    ``,
    `▶️ Descárgalo en la sección **Artifacts** de este run:`,
    ``,
    `${runUrl}`,
    ``,
    `_Tip:_ También puedes ver un thumbnail en el Job Summary.`
  ].join('\n');

  const res = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr.number,
    body
  });
  return res.data.html_url || '';
}

function log(msg: string) {
  console.log(msg);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
