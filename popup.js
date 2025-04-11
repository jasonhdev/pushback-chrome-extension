const container = document.getElementById("pushes");
const fileContainer = document.getElementById('fileContainer');
const sendContainer = document.getElementById('sendContainer');
const input = document.getElementById('messageInput');
const currentUrl = document.getElementById("currentUrl")
let pushes = [];

const showFileInput = () => {
  fileContainer.classList.remove('hidden');
  sendContainer.classList.add('hidden');
}

const showSendButton = () => {
  sendContainer.classList.remove('hidden');
  fileContainer.classList.add('hidden');
  currentUrl.replaceWith(document.createElement("p"));
}

const isUrl = (text) => {
  try {
    new URL(text);
    return true;
  } catch (_) {
    return false;
  }
};

const getPushHtml = (push) => {
  const content = push.body || push;

  return `<div class="pushRow">
            <p class="pushContent ${push.source_device_iden ? 'received' : 'sent'}">
                ${isUrl(content) ? `<a href="${content}" target="_blank">${content}</a>` : content}
            </p>
          </div>`
}

chrome.runtime.onMessage.addListener((chromeMessage) => {
  if (chromeMessage.action === 'pushReceived') {
    container.innerHTML += getPushHtml(chromeMessage.body);
  }
});

window.addEventListener('keydown', (event) => {
  if (document.activeElement !== input) {
    input.focus();
  }

  if (event.key === 'Enter') {
    let push = input.value;
    showFileInput();

    if (!push) {
      push = currentUrl.textContent;
    }

    chrome.runtime.sendMessage({ action: "push", body: push })
      .then(() => {
        container.innerHTML += getPushHtml(push);
        input.value = "";
      });
  }
});

input.addEventListener('input', () => {

  if (input.value.length > 0) {
    showSendButton();
  } else {
    showFileInput();
  }
});

chrome.storage.local.get("recentPushes", (data) => {
  pushes = data.recentPushes || [];

  if (pushes.length === 0) {
    container.innerText = "No unread messages.";
    return;
  }

  container.innerHTML = pushes.map(push =>
    getPushHtml(push)
  ).join("");

  // Clear badge and unread count
  // TODO: Dismiss message through API
  chrome.action.setBadgeText({ text: "" });
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];
  const url = currentTab.url;

  currentUrl.textContent = url;
});