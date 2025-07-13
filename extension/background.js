self.process = { env: {} };

import { create } from "@web3-storage/w3up-client";
import * as DID from '@ipld/dag-ucan/did';
import * as Delegation from '@ucanto/core/delegation'

let client;
let spaceDid;

chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CONFIG") {
    initClient(msg.email, msg.spaceDid)
      .then((did) => sendResponse({ ok: true, spaceDid: did }))
      .catch((err) => {
        console.error("CONFIG initClient failed:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});

async function initClient(email) {
  if (typeof process === "undefined") {
    self.process = { env: {} };
  }

  console.log("[DownloadArchiver] Initializing client…");
  client = await create();
  console.log("[DownloadArchiver] Client created.");

  console.log(`[DownloadArchiver] Logging in as ${email}…`);
  const account = await client.login(email);
  console.log("[DownloadArchiver] Logged in; waiting on plan…");
  await account.plan.wait();
  console.log("[DownloadArchiver] Plan ready.");

  console.log('[DownloadArchiver] Creating space "download-vault"…');
  const space = await client.createSpace("download-vault", { account });
  spaceDid = space.did();
  console.log("[DownloadArchiver] Space created with DID:", spaceDid);

  console.log("[DownloadArchiver] Setting current space…");
  await client.setCurrentSpace(spaceDid);
  console.log("[DownloadArchiver] Current space set.");

  const agentDid = client.did();
  console.log("[DownloadArchiver] Creating delegation for agent DID:", agentDid);

  const delegation = await client.createDelegation(
    DID.parse(agentDid),
    [
      "space/blob/add",
      "space/index/add",
      "upload/add",
      "filecoin/offer"
    ],
    { expiration: Infinity }
  );
  console.log("[DownloadArchiver] Delegation CID:", delegation.cid);

  const { ok: archiveBytes } = await delegation.archive();
  console.log("[DownloadArchiver] Archive generated:", archiveBytes);
const { ok: proof } = await Delegation.extract(new Uint8Array(archiveBytes))
if (!proof) {
  throw new Error('Failed to extract UCAN delegation')
}
  const sharedSpace = await client.addSpace(proof);
  console.log("[DownloadArchiver] Agent now has upload permissions!");
  console.log('[DownloadArchiver] Added shared space:', sharedSpace.did())
await client.setCurrentSpace(sharedSpace.did())


  console.log("[DownloadArchiver] Persisting config to storage…");
  await chrome.storage.local.set({ email, spaceDid });
  console.log("[DownloadArchiver] Configuration saved.");

  return spaceDid;
}


async function ensureClientReady() {
  console.log("[DownloadArchiver] ensureClientReady: start");
  const stored = await chrome.storage.local.get(['email', 'spaceDid']);
  console.log("[DownloadArchiver] Stored config:", stored);
  const email = stored.email;
  const storedDid = stored.spaceDid;

  if (!email) {
    console.error("[DownloadArchiver] ensureClientReady: no email configured");
    throw new Error("Extension not configured");
  }


  if (!client || !client.currentSpace()) {
    console.log("[DownloadArchiver] ensureClientReady: initializing client and space");
    client = await create();
    console.log("[DownloadArchiver] Client created");

    const account = await client.login(email);
    console.log("[DownloadArchiver] Logged in as", email);
    await account.plan.wait();
    console.log("[DownloadArchiver] Plan ready");

    if (storedDid) {
      console.log("[DownloadArchiver] Using stored spaceDid:", storedDid);
      spaceDid = storedDid;
      await client.setCurrentSpace(spaceDid);
      console.log("[DownloadArchiver] Current space set to storedDid");
    } else {
      console.log("[DownloadArchiver] No stored spaceDid, creating new space");
      const space = await client.createSpace("download-vault", { account });
      spaceDid = space.did();
      console.log("[DownloadArchiver] New space created:", spaceDid);
      await client.setCurrentSpace(spaceDid);
      console.log("[DownloadArchiver] Current space set to new space");
      await chrome.storage.local.set({ spaceDid });
      console.log("[DownloadArchiver] Saved new spaceDid in storage");
    }
  } else {
    console.log("[DownloadArchiver] Client & currentSpace already set:", client.currentSpace().did());
  }

}

chrome.downloads.onChanged.addListener(async (delta) => {
  console.log("[DownloadArchiver] download.onChanged event:", delta);
  if (delta.state?.current === "complete") {
    console.log("[DownloadArchiver] Download complete, ID =", delta.id);
    try {
     await ensureClientReady();
      console.log("[DownloadArchiver] Client ready, proceeding to fetch item", client);

      const [item] = await chrome.downloads.search({ id: delta.id });
      console.log("[DownloadArchiver] Download item:", item);
      if (!item || item.byExtension) {
        console.log("[DownloadArchiver] Skipping (no item or byExtension)");
        return;
      }

      console.log("[DownloadArchiver] Fetching blob from URL:", item.url);
      const response = await fetch(item.url);
      console.log("[DownloadArchiver] Fetch status:", response.status);
      const blob = await response.blob();
      console.log("[DownloadArchiver] Blob size:", blob.size);

      const file = new File([blob], item.filename);
      console.log("[DownloadArchiver] Created File object:", file);

      console.log("[DownloadArchiver] Uploading file to Storacha:", item.filename);
      const cid = await client.uploadFile(file);
      console.log("[DownloadArchiver] uploadFile() returned CID:", cid);

      console.log("cid to string:", cid.toString());

      console.log(
        `[DownloadArchiver] File uploaded successfully: ${item.filename} → https://${cid}.ipfs.w3s.link`
      )

      chrome.notifications.create({
        type: "basic",
        title: "DownloadArchiver",
        iconUrl: chrome.runtime.getURL('icons/48.png'),
        message: `${item.filename} → https://${cid}.ipfs.w3s.link`,
      });
      console.log("[DownloadArchiver] Notification sent");
    } catch (err) {
      console.error("[DownloadArchiver] Error uploading download:", err);
    }
  } else {
    console.log("[DownloadArchiver] download.onChanged event not 'complete', skipping");
  }
});