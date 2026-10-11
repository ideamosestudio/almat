import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = 'C:/Users/avant/Desktop/ALMAT/Nueva carpeta';
const destination = resolve('public/partners');
await mkdir(destination, { recursive: true });

const logos = [
  ['ChatGPT Image Oct 11, 2026, 05_21_41 AM-1.png', 'blindex.webp'],
  ['ChatGPT Image Oct 11, 2026, 05_21_42 AM-2.png', 'vasa.webp'],
  ['ChatGPT Image Oct 11, 2026, 05_21_43 AM-3.png', 'aluar.webp'],
  ['ChatGPT Image Oct 11, 2026, 05_21_43 AM-4.png', 'casasegat.webp'],
  ['ChatGPT Image Oct 11, 2026, 05_21_44 AM-5.png', 'mdt.webp'],
  ['ChatGPT Image Oct 11, 2026, 05_21_45 AM-6.png', 'vilo.webp']
];

for (const [input, output] of logos) {
  await sharp(`${source}/${input}`)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 480, height: 150, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${destination}/${output}`);
}

console.log(`Processed ${logos.length} partner logos.`);
