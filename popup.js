chrome.storage.local.get("recentPushes", (data) => {
  const container = document.getElementById("pushes");
  const pushes = data.recentPushes || [];

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