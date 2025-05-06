const app = document.getElementById('app');
const container = document.getElementById("pushes");
const fileContainer = document.getElementById('fileContainer');
const sendContainer = document.getElementById('sendContainer');
const input = document.getElementById('messageInput');
const fileInput = document.getElementById('fileInput');
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
  const isReceived = !!push.source_device_iden;
  const pushTypeClass = isReceived ? 'received' : 'sent';

  const renderFilePush = (push) => {
    const preview = push.file_type.startsWith("image/")
      ? `<img class="messageImg" src="${push.file_url}" />`
      : push.file_name;
    return `<a href="${push.file_url}" target="_blank">${preview}</a>`;
  };

  const renderTextPush = (content) => {
    if (isUrl(content)) {
      return `<a href="${content}" target="_blank">${content}</a>`;
    }
    return content.replace(/\n/g, "<br>");
  };

  const content = push.file_name
    ? renderFilePush(push)
    : renderTextPush(push.body || push);

  return `
    <div class="pushRow">
      <p class="pushContent ${pushTypeClass}">
        ${content}
      </p>
    </div>
  `;
};

const hideCurrentUrl = () => {
  currentUrl.remove();
}

const sendMessage = (filePush = null) => {

  let push = filePush ?? input.value;

  showFileInput();

  if (!push) {
    push = currentUrl.textContent;
  }

  chrome.runtime.sendMessage({ action: "sendPush", body: push })
    .then(() => {
      container.innerHTML += getPushHtml(push);
      input.value = "";
    });

  hideCurrentUrl();
}

document.addEventListener('DOMContentLoaded', () => {
  // Check for login
  chrome.storage.local.get(['accessToken'], (data) => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const tokenInput = document.getElementById('tokenInput');

    if (!data.accessToken) {
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

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
  });

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    chrome.runtime.sendMessage({ action: "getUploadUrl", file_name: file.name, file_type: file.type }, async (response) => {
      // Upload the file
      const uploadData = response.uploadData;


      try {
        const formData = new FormData();
        Object.entries(uploadData.data).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('file', file);

        await fetch(uploadData.upload_url, {
          method: 'POST',
          body: formData
        });

        const push = {
          file_name: file.name,
          file_type: file.type,
          file_url: uploadData.file_url,
        }

        sendMessage(push);

      } catch (error) {
        console.error('Upload failed:', error);
      }
    });
  });

  sendContainer.addEventListener("click", () => {
    sendMessage();
    hideCurrentUrl();
  })

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey) {
      return;
    }

    if (document.activeElement !== input) {
      input.focus();
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }

    hideCurrentUrl();

  });

  currentUrl.addEventListener('click', function () {
    showSendButton();
    this.classList.add('active');
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