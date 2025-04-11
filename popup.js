const container = document.getElementById("pushes");
const fileContainer = document.getElementById('fileContainer');
const sendContainer = document.getElementById('sendContainer');
const input = document.getElementById('messageInput');

let pushes = [];

chrome.runtime.onMessage.addListener((chromeMessage) => {
  if (chromeMessage.action === 'messageReceived') {
    container.innerHTML += (
      `<div class="messageRow">
          <p class="messageContent received">
            ${chromeMessage.text}
          </p>
        </div>`
    );
  }
});

function showFileInput() {
  fileContainer.classList.remove('hidden');
  sendContainer.classList.add('hidden');
}

function showSendButton() {
  sendContainer.classList.remove('hidden');
  fileContainer.classList.add('hidden');
}

input.addEventListener('input', () => {

  if (input.value.length > 0) {
    showSendButton();
  } else {
    showFileInput();
  }
});

input.addEventListener('keydown', async (event) => {

  if (event.key === 'Enter') {
    const message = input.value;
    showFileInput();

    chrome.runtime.sendMessage({ action: "sendMessage", text: message })
      .then(() => {
        container.innerHTML += (
          `<div class="messageRow">
          <p class="messageContent sent">
            ${message}
          </p>
        </div>`
        );

        input.value = "";
      });
  }
});

chrome.storage.local.get("recentPushes", (data) => {
  pushes = data.recentPushes || [];

  if (pushes.length === 0) {
    container.innerText = "No unread messages.";
    return;
  }

  container.innerHTML = pushes.map(p =>
    `<div class="messageRow">
        <p class="messageContent ${p.source_device_iden ? 'received' : 'sent'}">
          ${p.body}
        </p>
      </div>`
  ).join("");

  // Clear badge and unread count
  // TODO: Dismiss message through API
  chrome.action.setBadgeText({ text: "" });
});