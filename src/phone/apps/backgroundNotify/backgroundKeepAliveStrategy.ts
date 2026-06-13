import { isIOSWebKit } from '../../utils/platform'

/** iOS：静音循环播放 + Media Session；安卓：Web Locks + SW 心跳，不占音频通道 */
export function shouldUseAudioForKeepAlive(): boolean {
  return isIOSWebKit()
}
