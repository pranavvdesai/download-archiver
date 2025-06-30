import { create } from './lib/w3up-client.js';  

let client, key, spaceDid;

chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CONFIG') {
    key = Uint8Array.from(atob(msg.key), c=>c.charCodeAt(0));
    spaceDid = msg.spaceDid;
    initClient(msg.email, msg.spaceDid).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function initClient(email, savedSpaceDid) {
  client = await create();
  await client.login(email);
  await client.plan.wait();
  if (savedSpaceDid) {
    await client.setCurrentSpace(savedSpaceDid);
  } else {
    const spaces = client.spaces();
    if (spaces.length) {
      spaceDid = spaces[0].did();
      await client.setCurrentSpace(spaceDid);
    } else {
      const space = await client.createSpace('download-Archiver', { account: client.accounts()[`did:mailto:${email}`] });
      spaceDid = space.did();
    }
    chrome.storage.local.set({ spaceDid });
  }
}

chrome.downloads.onChanged.addListener(async delta => {
  if (delta.state && delta.state.current === 'complete') {
    const d = await chrome.downloads.search({ id: delta.id });
    const item = d[0];
    if (!item || item.byExtension) return;
    const url = item.url;
    const filename = item.filename;           // e.g. /Users/.../Downloads/foo.jpg
    chrome.downloads.download({
      url: `filesystem:chrome-extension://${chrome.runtime.id}/persistent/${filename}`,
      saveAs: false
    }, async fileEntryId => {
      const blob = await fetch(fileURL).then(r=>r.blob());
      const cid = await client.uploadFile(blob);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'Downloaded & Uploaded',
        message: `${item.filename} → https://${cid}.ipfs.w3s.link`
      });
    });
  }
});
