/** 《雨夜归零》角色立绘 · `剧本杀/《雨夜归零》/角色立绘/*立绘.jpg` */
import linwanxingPortrait from '../../../../剧本杀/《雨夜归零》/角色立绘/林晚星立绘.jpg?url'
import suwanqingPortrait from '../../../../剧本杀/《雨夜归零》/角色立绘/苏晚晴立绘.jpg?url'
import lujingchuanPortrait from '../../../../剧本杀/《雨夜归零》/角色立绘/陆景川立绘.jpg?url'
import shenzhiyiPortrait from '../../../../剧本杀/《雨夜归零》/角色立绘/沈知意立绘.jpg?url'
import chengyuanPortrait from '../../../../剧本杀/《雨夜归零》/角色立绘/程予安立绘.jpg?url'

const YUYE_ROLE_PORTRAITS: Record<string, string> = {
  林晚星: linwanxingPortrait,
  苏晚晴: suwanqingPortrait,
  陆景川: lujingchuanPortrait,
  沈知意: shenzhiyiPortrait,
  程予安: chengyuanPortrait,
}

export function resolveJbsRolePortrait(scriptId: string, roleName: string): string | undefined {
  if (scriptId !== 'yuye-guiling') return undefined
  return YUYE_ROLE_PORTRAITS[roleName.trim()]
}

export function listYuyeRolePortraitNames(): string[] {
  return Object.keys(YUYE_ROLE_PORTRAITS)
}
