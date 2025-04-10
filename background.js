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
  const pushes = data.pushes.filter(p => p.type === "note" && !p.dismissed).reverse();
  unreadCount = pushes.length;

  chrome.storage.local.set({ recentPushes: pushes });

  if (!pushes[pushes.length - 1].source_device_iden) {
    return;
  }

  if (unreadCount > 0) {
    chrome.action.setBadgeText({ text: unreadCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  }
}

connectSocket();
