const container = document.getElementById("pushes");
const fileContainer = document.getElementById('fileContainer');
const sendContainer = document.getElementById('sendContainer');
const input = document.getElementById('messageInput');

let pushes = [];

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
    sendMessage(message);


  }
});

const sendMessage = async (message) => {
  try {
    const response = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        type: 'note',
        title: 'From PC',
        body: message,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Push sent successfully:', data);
      container.innerHTML += (`<div class="messageRow">
        ${message}
      </div>`);

      input.value = "";

    } else {
      console.error('Error sending push:', data);
    }
  } catch (error) {
    console.error('Error sending push:', error);
  }
}

chrome.storage.local.get("recentPushes", (data) => {
  pushes = data.recentPushes || [];

  if (pushes.length === 0) {
    container.innerText = "No unread messages.";
    return;
  }

  container.innerHTML = pushes.map(p =>
    `<div class="messageRow">
        ${p.body}
      </div>`
  ).join("");

  // Clear badge and unread count
  // TODO: Dismiss message through API
  chrome.action.setBadgeText({ text: "" });
});