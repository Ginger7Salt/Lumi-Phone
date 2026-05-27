/** 《雨夜归零》· 聊天室氛围背景（Vite ?url） */
import yuyeChatRoomBgVideo from '../../../剧本杀/《雨夜归零》/聊天室背景视频.mp4?url'
import yuyeGameplayBgm from '../../../剧本杀/《雨夜归零》/功能音频/BGM1.mp3?url'

export function getChatRoomVideoUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeChatRoomBgVideo
  return undefined
}

/** 游玩全程背景音乐（独立 Audio 轨，与 DM 语音 / 视频氛围轨分轨） */
export function getChatRoomBgmUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeGameplayBgm
  return undefined
}
