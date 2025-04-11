let ACCESS_TOKEN = "";
let unreadCount = 0;

//TODO: Prompt to enter user access token
// chrome.storage.local.set({ access_token: ACCESS_TOKEN });
const connectSocket = async () => {
  const fetchAccessToken = async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('access_token', function (data) {
        if (data.access_token) {
          resolve(data.access_token);
        } else {
          reject("No access token found.");
        }
      });
    });
  }

  try {
    ACCESS_TOKEN = await fetchAccessToken();
  } catch (error) {
    console.log(error);
  }

  const socketUrl = `wss://stream.pushbullet.com/websocket/${ACCESS_TOKEN}`;
  const socket = new WebSocket(socketUrl);

  socket.onopen = () => {
    console.log("Connected to Pushbullet stream");
    fetchPushes();
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "tickle" && data.subtype === "push") {
      fetchPushes();
    }
  };

  socket.onclose = () => setTimeout(connectSocket, 5000);
  socket.onerror = (err) => console.error("WebSocket error:", err);
}

const fetchPushes = () => {
  fetch("https://api.pushbullet.com/v2/pushes?active=true&limit=3", {
    headers: { "Access-Token": ACCESS_TOKEN }
  })
    .then(res => res.json())
    .then(data => {
      if (!data.pushes) {
        return;
      }

      processData(data);
    });
}

const processData = (data) => {
  // && !p.dismissed
  const pushes = data.pushes.filter(p => p.type === "note").reverse();
  unreadCount = pushes.length;

  chrome.storage.local.set({ recentPushes: pushes });

  console.log(pushes);

  const mostRecentPush = pushes[pushes.length - 1];
  if (!mostRecentPush.source_device_iden) {
    return;
  }

  chrome.runtime.sendMessage({ action: "messageReceived", text: mostRecentPush.body })
    .catch(err => {
      console.warn("Popup not open:", err.message);
    });

  if (unreadCount > 0) {
    chrome.action.setBadgeText({ text: unreadCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  }
}

chrome.runtime.onMessage.addListener(async (chromeMessage) => {
  if (chromeMessage.action === 'sendMessage') {
    try {
      const response = await fetch('https://api.pushbullet.com/v2/pushes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'note',
          body: chromeMessage.text,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Push sent successfully:', data);
      } else {
        console.error('Error sending push:', data);
      }
    } catch (error) {
      console.error('Error sending push:', error);
    }
  }
});

connectSocket();
