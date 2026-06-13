let keepAliveBootReady = false
let keepAliveUserGesturePrimed = false

export function isKeepAliveBootReady(): boolean {
  return keepAliveBootReady
}

export function isKeepAliveUserGesturePrimed(): boolean {
  return keepAliveUserGesturePrimed
}

export function markKeepAliveBootReady(): void {
  keepAliveBootReady = true
}

export function notifyKeepAliveEnabledFromUserGesture(): void {
  keepAliveUserGesturePrimed = true
  keepAliveBootReady = true
}

export function resetKeepAliveBootGate(): void {
  keepAliveBootReady = false
  keepAliveUserGesturePrimed = false
}

export function markKeepAliveUserGesturePrimed(): void {
  keepAliveUserGesturePrimed = true
}
