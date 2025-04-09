const socketUrl = `wss://stream.pushbullet.com/websocket/${ACCESS_TOKEN}`;

let unreadCount = 0;

const connectSocket = () => {
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
    });
}

const processData = (data) => {
  const pushes = data.pushes.filter(p => p.type === "note" && !p.dismissed);
  unreadCount = pushes.length;

  chrome.storage.local.set({ recentPushes: pushes });

  if (unreadCount > 0) {
    chrome.action.setBadgeText({ text: unreadCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  }
}

connectSocket();
