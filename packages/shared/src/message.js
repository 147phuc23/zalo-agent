export function createInboundMessageEvent({
  channel,
  threadId,
  senderId,
  text,
  raw,
}) {
  return {
    id: buildEventId(channel, threadId),
    kind: "message.received",
    channel,
    threadId,
    senderId,
    text,
    receivedAt: new Date().toISOString(),
    raw,
  };
}

function buildEventId(channel, threadId) {
  return `${channel}:${threadId}:${Date.now()}`;
}
