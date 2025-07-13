(async () => {
  const emailInput = document.getElementById('email');
  const saveBtn    = document.getElementById('save');
  const statusDiv  = document.getElementById('status');

  const stored = await chrome.storage.local.get(['email','spaceDid']);
  if (stored.email) emailInput.value = stored.email;

  saveBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    if (!email.includes('@')) {
      statusDiv.textContent = 'Please enter a valid email.';
      return;
    }

    // Send config to background
    chrome.runtime.sendMessage(
  { type: 'CONFIG', email, spaceDid: stored.spaceDid || null },
  resp => {
    if (resp?.ok) {
      chrome.storage.local.set({ email, spaceDid: resp.spaceDid });
      statusDiv.textContent = 'Configuration saved and connected!';
    } else {
      statusDiv.textContent = 'Failed to configure: ' + (resp.error || 'unknown');
      console.error('CONFIG error:', resp.error);
    }
  }
);

  });
})();
