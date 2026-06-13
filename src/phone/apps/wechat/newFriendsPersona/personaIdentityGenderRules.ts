import type { Gender } from './types'
import { genderLabelZh } from './utils'

/** 称呼「你」时明显偏女性向（绑定男身份时不应出现） */
const FEMALE_TILTED_ADDRESSING = [
  '小姐姐',
  '小姐',
  '姑娘',
  '妹子',
  '女士',
  '美眉',
  '美女',
  '姐姐',
  '小姑',
  '小仙女',
]

/** 称呼「你」时明显偏男性向（绑定女身份时不应出现） */
const MALE_TILTED_ADDRESSING = [
  '兄弟',
  '哥们',
  '老哥',
  '老兄',
  '小伙',
  '小伙子',
  '帅哥',
  '兄台',
  '老铁',
  '弟兄',
]

/** 看法/旁白中对「你」的性别化描摹（男身份不应出现左列，女身份不应出现右列） */
const FEMALE_VIEW_MARKERS = ['姑娘', '女生', '女孩子', '小姐', '妹子', '美女', '少女', '小姑', '小姐姐']
const MALE_VIEW_MARKERS = ['小伙', '男生', '男孩子', '兄弟', '帅哥', '少年', '小伙子', '老哥', '男子汉']

export function addressingGenderMismatch(phrase: string, gender: Gender | undefined | null): boolean {
  if (!phrase.trim() || !gender || gender === 'other') return false
  const p = phrase.trim()
  if (gender === 'male') return FEMALE_TILTED_ADDRESSING.some((t) => p.includes(t))
  if (gender === 'female') return MALE_TILTED_ADDRESSING.some((t) => p.includes(t))
  return false
}

export function viewTextGenderMismatch(text: string, gender: Gender | undefined | null): boolean {
  if (!text.trim() || !gender || gender === 'other') return false
  const t = text.trim()
  if (gender === 'male') return FEMALE_VIEW_MARKERS.some((m) => t.includes(m))
  if (gender === 'female') return MALE_VIEW_MARKERS.some((m) => t.includes(m))
  return false
}

export function playerIdentityGenderRulesForAi(gender: Gender | undefined | null): string {
  const label = genderLabelZh(gender)
  if (gender === 'male') {
    return `操作者性别：${label}。称呼禁止小姐/姑娘/妹子/女士/小姐姐等女性向称谓；theySeeYou 第三人称用「他」，禁止写成女生/姑娘/她指操作者。`
  }
  if (gender === 'female') {
    return `操作者性别：${label}。称呼禁止兄弟/哥们/小伙/老哥/帅哥等男性向称谓；theySeeYou 第三人称用「她」，禁止写成男生/小伙子/他指操作者。`
  }
  return `操作者性别：${label}。称呼与看法避免与身份性别明显冲突。`
}

export function describeGenderMismatchInAddressing(
  phrase: string,
  gender: Gender | undefined | null,
): string | null {
  if (!addressingGenderMismatch(phrase, gender)) return null
  return `称呼「${phrase.trim()}」与当前身份性别（${genderLabelZh(gender)}）不符`
}

export function describeGenderMismatchInView(
  text: string,
  gender: Gender | undefined | null,
): string | null {
  if (!viewTextGenderMismatch(text, gender)) return null
  return `看法文案与当前身份性别（${genderLabelZh(gender)}）不符`
}
