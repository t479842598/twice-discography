import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flagsDir = path.join(__dirname, '../public/flags');

// 确保目录存在
if (!fs.existsSync(flagsDir)) {
  fs.mkdirSync(flagsDir, { recursive: true });
}

// 国旗图片 URL
const flags = {
  kr: 'https://flagcdn.com/w40/kr.png',
  jp: 'https://flagcdn.com/w40/jp.png',
  // 台湾使用 emoji 转 PNG（或者使用其他来源）
  tw: 'https://flagcdn.com/w40/tw.png', // 先尝试这个
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded: ${dest}`);
          resolve();
        });
      } else {
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadAllFlags() {
  console.log('Downloading flags...');

  for (const [code, url] of Object.entries(flags)) {
    const dest = path.join(flagsDir, `${code}.png`);
    try {
      await downloadFile(url, dest);
    } catch (err) {
      console.error(`✗ Failed to download ${code}: ${err.message}`);
    }
  }

  console.log('Done!');
}

downloadAllFlags();
