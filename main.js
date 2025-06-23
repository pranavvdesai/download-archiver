import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { create } from '@web3-storage/w3up-client';
import { filesFromPaths } from 'files-from-path';

async function main() {
  const client = await create();
  
  console.log('Please login with your email to Storacha:');
  process.stdout.write('Email: ');
  const email = await new Promise(resolve => {
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });
  const account = await client.login(email);
await account.plan.wait();
console.log('Logged in and UCAN delegation claimed.');

let space;
if (typeof client.spaces === 'function') {
  const spaces = client.spaces();
  if (spaces.length > 0) {
    space = spaces[0];
    console.log(`Using existing space: ${space.did()}`);
  } else {
    space = await client.createSpace("download-archiver", { account });
    console.log(`Created new space: ${space.did()}`);
  }
} else {
  // Fallback: always create if listSpaces not available
  space = await client.createSpace("download-archiver", { account });
  console.log(`Created space: ${space.did()}`);
}


  const downloadsDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads');

  const watcher = chokidar.watch(downloadsDir, {
    ignoreInitial: true,
    usePolling: true,       
    interval: 1000,          
    binaryInterval: 1000,
    depth: 0                
  });

 watcher.on('add', async filePath => {
    try {
      const base = path.basename(filePath);
      if (base.startsWith('.')) {
        console.log(`Skipping hidden/system file: ${base}`);
        return;
      }
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        console.log(`Skipping non-file: ${base}`);
        return;
      }

      console.log(`Detected new file: ${filePath}`);
      const files = await filesFromPaths([filePath]);
      const file = files[0];
      const cid = await client.uploadFile(file);
      console.log(`Uploaded ${path.basename(filePath)} → ${cid}.ipfs.w3s.link`);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  });

  watcher.on('error', error => {
    console.error('Watcher error:', error.message);
  });

  console.log(`Watching downloads folder: ${downloadsDir}`);
}

main().catch(console.error);(console.error);
