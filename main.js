import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { create } from '@web3-storage/w3up-client';
import { filesFromPaths } from 'files-from-path';

async function main() {
  const client = await create();
  
  // Prompting user to login via email
  console.log('Please login with your email to Storacha:');
  process.stdout.write('Email: ');
  const email = await new Promise(resolve => {
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });
  const account = await client.login(email);
  await account.plan.wait();
  const space = await client.createSpace("trial", { account });

  console.log('Logged in and space provisioned.', space);

  // Determine downloads folder (default to ~/Downloads)
  const downloadsDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads');

  // Watch for new files added
  const watcher = chokidar.watch(downloadsDir, { ignoreInitial: true });
  watcher.on('add', async filePath => {
    try {
      console.log(`Detected new file: ${filePath}`);
      // Read file(s) as File-like objects
      const files = await filesFromPaths([filePath]);
      const file = files[0];
      // Upload to Storacha
      const cid = await client.uploadFile(file);
      console.log(`Uploaded ${path.basename(filePath)} → ${cid}.ipfs.w3s.link`);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  });

  console.log(`Watching downloads folder: ${downloadsDir}`);
}

main().catch(console.error);
