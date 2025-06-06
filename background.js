let ACCESS_TOKEN = null;
let storagePushes = [];
let socket;

const connectSocket = async () => {
  try {
    await fetchAccessToken();
  } catch (err) {
    console.warn('Token fetch failed:', err);
    return;
  }

  await fetchStoragePushes();

  try {
    const socketUrl = `wss://stream.pushbullet.com/websocket/${ACCESS_TOKEN}`;
    socket = new WebSocket(socketUrl);
  }
  catch (err) {
    console.warn(err);
  }

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
  const modifiedAfter = storagePushes.at(-1)?.created ?? 0;

  fetch(`https://api.pushbullet.com/v2/pushes?active=true&limit=5&modified_after=${modifiedAfter}`, {
    headers: { "Access-Token": ACCESS_TOKEN }
  })
    .then(res => res.json())
    .then(data => {

      const storagePushIdens = new Set(storagePushes.map(p => p.iden));
      const newPushes = data.pushes
        .filter(p => !storagePushIdens.has(p.iden))
        .reverse();

      if (!newPushes.length) {
        return;
      }

      const updatedStoragePushes = [...storagePushes, ...newPushes].slice(-15);
      storagePushes = updatedStoragePushes;

      chrome.storage.local.set({ 'recentPushes': updatedStoragePushes });

      for (const newPush of newPushes) {
        if (!newPush.source_device_iden) {
          continue;
        }

        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Pushback',
          message: newPush.body || newPush.file_name || "You received a push!",
          priority: 1
        });

        chrome.runtime.sendMessage({ action: "pushReceived", body: newPush })
          .catch(err => {
            console.warn("Popup not open:", err.message);
          });
      }

      const unreadCount = storagePushes.filter(p => !p.dismissed && p.source_device_iden).length;

      if (unreadCount > 0) {
        chrome.action.setBadgeText({ text: unreadCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
      }
    });
}

const handleSendPush = async (message, sendResponse) => {
  try {
    await fetchAccessToken();

    console.log(message);

    if (message.file_name) {
      body = JSON.stringify({
        type: 'file',
        file_name: message.file_name,
        file_type: message.file_type,
        file_url: message.file_url,
        body: "",
      })
    } else {
      body = JSON.stringify({
        type: 'note',
        body: message,
      })
    }

    const response = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: body
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

const handleMarkRead = async (chromeMessage, sendResponse) => {
  const iden = chromeMessage.iden;

  fetch(`https://api.pushbullet.com/v2/pushes/${iden}`, {
    method: 'POST',
    headers: {
      'Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ dismissed: chromeMessage.dismissed })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to dismiss push ${iden}`);
      }
      return response.json();
    })
    .then(() => {
      const push = storagePushes.find(p => p.iden === iden);
      if (push) {
        push.dismissed = true;
      }

      chrome.storage.local.set({ 'recentPushes': storagePushes });

      console.log(`Push ${iden} dismissed`);
    })
    .catch(err => {
      console.error(err);
    });

  sendResponse({ success: true });
}

const handleGetUploadUrl = async (chromeMessage, sendResponse) => {

  // Request URL for upload
  const uploadRequest = await fetch('https://api.pushbullet.com/v2/upload-request', {
    method: 'POST',
    headers: {
      'Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file_name: chromeMessage.file_name,
      file_type: chromeMessage.file_type
    })
  });

  const uploadData = await uploadRequest.json();

  sendResponse({ success: true, uploadData: uploadData });
}

chrome.runtime.onMessage.addListener((chromeMessage, sender, sendResponse) => {
  if (chromeMessage.action === "sendPush") {
    handleSendPush(chromeMessage.body, sendResponse);
  }

  if (chromeMessage.action === 'setAccessToken') {
    handleValidateToken(chromeMessage.token, sendResponse);
  }

  if (chromeMessage.action === 'markRead') {
    handleMarkRead(chromeMessage, sendResponse);
  }

  if (chromeMessage.action === 'getUploadUrl') {
    handleGetUploadUrl(chromeMessage, sendResponse);
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