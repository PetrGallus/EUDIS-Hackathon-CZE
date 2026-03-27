#!/usr/bin/env node
/**
 * download-assets.mjs
 *
 * Downloads CC0 graphical assets for the EUDIS marketing 3D scene.
 * All sources are CC0 / public domain:
 *   - Poly Haven  (polyhaven.com)  — HDRIs and PBR textures
 *
 * Run from repo root:
 *   node gamified-physical-webapp/tools/download-assets.mjs
 *
 * Assets land in:
 *   gamified-physical-webapp/apps/marketing/public/hdri/
 *   gamified-physical-webapp/apps/marketing/public/textures/
 */

import { mkdir } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Script lives at gamified-physical-webapp/tools/download-assets.mjs
const PUBLIC = path.resolve(__dirname, '../apps/marketing/public');

// ──────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function downloadFile(url, destPath) {
  await mkdir(path.dirname(destPath), { recursive: true });
  if (existsSync(destPath)) {
    return 'already exists — skipped';
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(destPath));
  return 'downloaded';
}

/** Fetch Poly Haven file manifest for a given asset id. */
async function phFiles(assetId) {
  return fetchJson(`https://api.polyhaven.com/files/${assetId}`);
}

/**
 * Pick download URL from a Poly Haven texture map entry at a given resolution.
 * Tries jpg first, then png (normals / AO are usually png only).
 */
function pickUrl(files, mapKey, res = '1k') {
  const entry = files?.[mapKey]?.[res];
  return entry?.jpg?.url ?? entry?.png?.url ?? null;
}

/** Find the first key in a manifest that matches a regex. */
function findKey(files, re) {
  return Object.keys(files).find((k) => re.test(k)) ?? null;
}

// ──────────────────────────────────────────────────────────────────
// Kit definitions
// ──────────────────────────────────────────────────────────────────

const HDRI_DIR = path.join(PUBLIC, 'hdri');
const TEX_DIR  = path.join(PUBLIC, 'textures');

const kits = [
  // ── Kit 1: Night-sky HDRI (Ticknock, Ireland — CC0) ─────────────
  {
    name: 'HDRI — Ticknock Night Sky (.exr)',
    desc: 'Replaces drei <Environment preset="night" /> with a real 32-bit EXR for richer reflections.',
    fn: async () => {
      const files = await phFiles('ticknock_02');
      // Prefer .exr (32-bit linear), fall back to .hdr
      const entry = files?.hdri?.['1k'];
      const url = entry?.exr?.url ?? entry?.hdr?.url;
      if (!url) throw new Error(`Unexpected API shape — keys: ${JSON.stringify(Object.keys(files?.hdri ?? {}))}`);
      const ext = url.endsWith('.exr') ? '.exr' : '.hdr';
      return [{ url, dest: path.join(HDRI_DIR, `ticknock_02_1k${ext}`) }];
    },
  },

  // ── Kit 2: Rock face — island rocky bases ────────────────────────
  {
    name: 'Texture — Rock Face (island surfaces)',
    desc: 'PBR diffuse + normal + roughness for the island dodecahedron base meshes.',
    fn: async () => {
      const files = await phFiles('rock_face');
      const downloads = [];

      const pairs = [
        { re: /diffuse|color|albedo/i, label: 'island_rock_diff' },
        { re: /nor_gl/i,              label: 'island_rock_nor'  },
        { re: /roughness|rough(?!ness)/i, label: 'island_rock_rough' },
      ];

      for (const { re, label } of pairs) {
        const key = findKey(files, re);
        if (!key) continue;
        const url = pickUrl(files, key);
        if (!url) continue;
        const ext = path.extname(new URL(url).pathname);
        downloads.push({ url, dest: path.join(TEX_DIR, `${label}_1k${ext}`) });
      }

      if (downloads.length === 0) {
        throw new Error(`No usable map keys found. Available: ${Object.keys(files).join(', ')}`);
      }
      return downloads;
    },
  },

  // ── Kit 3: Metal plate — drone body / landing pad hexagons ───────
  {
    name: 'Texture — Metal Plate (drone body & landing pads)',
    desc: 'PBR metal diffuse + normal + roughness + metallic maps.',
    fn: async () => {
      const files = await phFiles('metal_plate');
      const downloads = [];

      const pairs = [
        { re: /diffuse|color|albedo/i, label: 'metal_plate_diff'  },
        { re: /nor_gl/i,              label: 'metal_plate_nor'   },
        { re: /roughness|rough(?!ness)/i, label: 'metal_plate_rough' },
        { re: /metallic|metalness/i,  label: 'metal_plate_metal' },
      ];

      for (const { re, label } of pairs) {
        const key = findKey(files, re);
        if (!key) continue;
        const url = pickUrl(files, key);
        if (!url) continue;
        const ext = path.extname(new URL(url).pathname);
        downloads.push({ url, dest: path.join(TEX_DIR, `${label}_1k${ext}`) });
      }

      if (downloads.length === 0) {
        throw new Error(`No usable map keys found. Available: ${Object.keys(files).join(', ')}`);
      }
      return downloads;
    },
  },

  // ── Kit 4: Concrete wall — island core platform (cylinder) ───────
  {
    name: 'Texture — Concrete Wall (island platforms)',
    desc: 'PBR concrete diffuse + normal for the cylindrical island platform mesh.',
    fn: async () => {
      // Try numbered variant first, then bare name
      let files;
      for (const id of ['concrete_wall_008', 'concrete_wall']) {
        try {
          files = await phFiles(id);
          if (files && Object.keys(files).length > 0) break;
        } catch {
          /* try next id */
        }
      }
      if (!files) throw new Error('Could not resolve concrete_wall asset from Poly Haven.');

      const downloads = [];

      const pairs = [
        { re: /diffuse|color|albedo/i, label: 'concrete_diff' },
        { re: /nor_gl/i,              label: 'concrete_nor'  },
        { re: /roughness|rough(?!ness)/i, label: 'concrete_rough' },
      ];

      for (const { re, label } of pairs) {
        const key = findKey(files, re);
        if (!key) continue;
        const url = pickUrl(files, key);
        if (!url) continue;
        const ext = path.extname(new URL(url).pathname);
        downloads.push({ url, dest: path.join(TEX_DIR, `${label}_1k${ext}`) });
      }

      if (downloads.length === 0) {
        throw new Error(`No usable map keys found. Available: ${Object.keys(files).join(', ')}`);
      }
      return downloads;
    },
  },

  // ── Kit 5: Water caustic normal — water shader surface detail ────
  {
    name: 'Texture — Coast Sand (water surface normal)',
    desc: 'Normal map added to uNormalMap uniform in the OceanSurface shader for micro-detail.',
    fn: async () => {
      let files;
      for (const id of ['coast_sand_01', 'coast_sand_rocks_02', 'sand_01']) {
        try {
          files = await phFiles(id);
          if (files && Object.keys(files).length > 0) break;
        } catch {
          /* try next */
        }
      }
      if (!files) throw new Error('Could not resolve a coast/sand asset from Poly Haven.');

      const norKey = findKey(files, /nor_gl/i);
      if (!norKey) throw new Error(`No nor_gl map. Available: ${Object.keys(files).join(', ')}`);

      const url = pickUrl(files, norKey);
      if (!url) throw new Error('nor_gl entry had no jpg/png url.');

      const ext = path.extname(new URL(url).pathname);
      return [{ url, dest: path.join(TEX_DIR, `water_nor_1k${ext}`) }];
    },
  },
];

// ──────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────

async function runKit(kit) {
  const downloads = await kit.fn();
  const results = [];
  for (const { url, dest } of downloads) {
    const status = await downloadFile(url, dest);
    const rel = path.relative(PUBLIC, dest).replaceAll(path.sep, '/');
    results.push(`   ✓ public/${rel}  [${status}]`);
  }
  return results;
}

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  EUDIS Marketing — CC0 Asset Downloader');
  console.log('══════════════════════════════════════════════');
  console.log(`  Output root: ${PUBLIC}\n`);

  let ok = 0;
  let fail = 0;

  for (const kit of kits) {
    console.log(`▶  ${kit.name}`);
    console.log(`   ${kit.desc}`);
    try {
      const lines = await runKit(kit);
      lines.forEach((l) => console.log(l));
      ok++;
    } catch (err) {
      console.log(`   ✗ FAILED — ${err.message}`);
      fail++;
    }
    console.log();
  }

  console.log('══════════════════════════════════════════════');
  console.log(`  ${ok} kit(s) succeeded   ${fail} failed`);
  console.log('══════════════════════════════════════════════\n');

  if (ok > 0) {
    console.log('Next steps (done automatically when you run the dev server):');
    console.log('  • HDRI:    <Environment files="/hdri/ticknock_02_1k.exr" />');
    console.log('  • Textures: wired into ProjectIsland + OceanSurface via useTexture\n');
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
