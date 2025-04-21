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

document.addEventListener('DOMContentLoaded', () => {

  // Check for login
  chrome.storage.local.get(['accessToken'], (data) => {
    if (!data.accessToken) {
      const loginForm = document.getElementById('loginForm');
      const app = document.getElementById('app');
      const loginBtn = document.getElementById('loginBtn');
      const tokenInput = document.getElementById('tokenInput');

      loginForm.style.display = "block";
      app.style.display = "none";

      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const token = tokenInput.value.trim();
        if (!token) {
          return;
        }

        chrome.runtime.sendMessage({ action: 'setAccessToken', token: token },
          (response) => {
            if (response?.success) {
              loginForm.style.display = "none";
              app.style.display = "block";

            } else {
              const errorMsg = document.getElementById('loginErrorMsg');
              errorMsg.style.display = "block";
            }
          }
        );
      });
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

      if (!push.length) {
        return;
      }

      chrome.runtime.sendMessage({ action: "sendPush", body: push })
        .then(() => {
          container.innerHTML += getPushHtml(push);
          input.value = "";
        });
    }

    currentUrl.replaceWith(document.createElement("p"));
    currentUrl.textContent = "";

  });

  input.addEventListener('input', () => {

    if (input.value.length > 0) {
      showSendButton();
    } else {
      showFileInput();
    }
  });

  // Listen for new messages
  chrome.runtime.onMessage.addListener((chromeMessage) => {
    if (chromeMessage.action === 'pushReceived') {
      container.innerHTML += getPushHtml(chromeMessage.body);
    }
  });

  // Fetch pushes from local storage upon each popup open
  chrome.storage.local.get("recentPushes", (data) => {
    pushes = data.recentPushes || [];

    if (pushes.length === 0) {
      container.innerText = "No unread messages.";
      return;
    }

    container.innerHTML = pushes.map(push =>
      getPushHtml(push)
    ).join("");

    // Clear badge and marked as read
    chrome.action.setBadgeText({ text: "" });

    pushes.filter(push => !push.dismissed).forEach(push => {
      chrome.runtime.sendMessage({ action: "markRead", dismissed: true, iden: push.iden });
    });
  });

  // Attach current browser URL to message input
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;

    currentUrl.textContent = url;
  });
});