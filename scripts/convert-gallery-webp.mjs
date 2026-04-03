import sharp from 'sharp';
import { existsSync } from 'fs';

const files = [
  'public/images/hf_20260401_112814_bb9cb2e4-de00-431c-9b4e-a2ac51eeb50e.png',
  'public/images/hf_20260401_112830_62cdfc50-46ea-41e5-ade4-21bcb3e68feb.png',
  'public/images/feier/hf_20260401_112437_90efe0bf-d541-4057-82fa-e56047314bed.png',
  'public/images/feier/hf_20260401_112505_ffe14f9c-c97c-4987-85fe-ffaac6b1e887.png'
];

for (const p of files) {
  if (!existsSync(p)) {
    console.error('Missing:', p);
    process.exit(1);
  }
  const out = p.replace(/\.png$/i, '.webp');
  await sharp(p)
    .webp({ quality: 92, effort: 6, smartSubsample: true })
    .toFile(out);
  console.log(out);
}
