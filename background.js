let ACCESS_TOKEN = null;
let storagePushes = [];
let socket;

//TODO: Prompt to enter user access token
const connectSocket = async () => {
  try {
    await fetchAccessToken();
  } catch (err) {
    console.warn('Token fetch failed:', err);
    return;
  }

  await fetchStoragePushes();

  const socketUrl = `wss://stream.pushbullet.com/websocket/${ACCESS_TOKEN}`;
  socket = new WebSocket(socketUrl);

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

const fetchAccessToken = async () => {
  if (ACCESS_TOKEN) {
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get('accessToken', function (data) {
      if (data.accessToken) {
        ACCESS_TOKEN = data.accessToken;
        resolve();
      } else {
        reject("No access token found.");
      }
    });
  });
}

const fetchStoragePushes = async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get('recentPushes', function (data) {
      if (data.recentPushes) {
        storagePushes = data.recentPushes;
      } else {
        storagePushes = [];
      }

      resolve();
    });
  });
}

const fetchPushes = () => {
  const modifiedAfter = storagePushes.length ? storagePushes[storagePushes.length - 1].created : 0;

  fetch(`https://api.pushbullet.com/v2/pushes?active=true&limit=3&modified_after=${modifiedAfter}`, {
    headers: { "Access-Token": ACCESS_TOKEN }
  })
    .then(res => res.json())
    .then(data => {

      const storagePushIdens = new Set(storagePushes.map(p => p.iden));
      const unseenPushes = data.pushes
        .filter(p => !storagePushIdens.has(p.iden))
        .filter(p => p.type === "note").reverse();

      if (!unseenPushes.length) {
        return;
      }

      processData(unseenPushes);
    });
}

const processData = (unseenPushes) => {
  const updatedStoragePushes = [...storagePushes, ...unseenPushes].slice(-5);
  chrome.storage.local.set({ 'recentPushes': updatedStoragePushes });

  const mostRecentPush = unseenPushes[unseenPushes.length - 1];
  if (!mostRecentPush.source_device_iden) {
    return;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Pushback',
    message: mostRecentPush.body,
    priority: 1
  });

  chrome.runtime.sendMessage({ action: "pushReceived", body: mostRecentPush })
    .catch(err => {
      console.warn("Popup not open:", err.message);
    });

  const unreadCount = unseenPushes.length;

  if (unreadCount > 0) {
    chrome.action.setBadgeText({ text: unreadCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  }
}

const handleSendPush = async (message, sendResponse) => {
  try {
    await fetchAccessToken();

    const response = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        type: 'note',
        body: message,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Push sent successfully:', data);
    } else {
      console.error('Error sending push:', data.error?.message || JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error sending push:', error);
  }

  sendResponse({ success: true });
}

const handleValidateToken = async (token, sendResponse) => {
  try {
    const res = await fetch("https://api.pushbullet.com/v2/users/me", {
      method: "GET",
      headers: {
        "Access-Token": token
      }
    });

    if (!res.ok) {
      throw new Error(`Invalid token (status ${res.status})`);
    }

    chrome.storage.local.set({ accessToken: token });
    sendResponse({ success: true });
    connectSocket();

  } catch (err) {
    console.warn("Token validation failed:", err.message);
    sendResponse({ succes: false });
  }
}

chrome.runtime.onMessage.addListener((chromeMessage, sender, sendResponse) => {
  if (chromeMessage.action === "sendPush") {
    handleSendPush(chromeMessage.body, sendResponse);
  }

  if (chromeMessage.action === 'setAccessToken') {
    handleValidateToken(chromeMessage.token, sendResponse);
  }

  return true;
});

connectSocket();

// Hack to keep service worker alive in manifest v3
setInterval(() => {
  chrome.storage.local.set({ lastAlive: new Date().toISOString() });
}, 20000);

chrome.alarms.create('checkReconnect', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkReconnect') {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      console.log("connecting through alarm!");
      connectSocket();
    }
  }
});