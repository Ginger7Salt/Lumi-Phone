import type { MomentsImageModelOption } from './momentsImageModelCatalog'

/** 官方定价：https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya */
const QIANFAN_IMAGE_PRICE_YUAN: Record<string, number> = {
  'flux.1-schnell': 0.005,
  'musesteamer-air-image': 0.05,
  'ernie-image-turbo': 0.11,
  'qwen-image': 0.25,
}

type QianfanImageModelDef = {
  modelName: string
  labelZh: string
  description: string
  endpoint: 'generations' | 'musesteamer'
}

/** 千帆文生图模型（官方模型列表 + 图像生成能力选型指南） */
const QIANFAN_IMAGE_MODEL_DEFS: QianfanImageModelDef[] = [
  {
    modelName: 'flux.1-schnell',
    labelZh: 'FLUX.1-schnell',
    description: '极速生成与原型验证，性价比极高',
    endpoint: 'generations',
  },
  {
    modelName: 'musesteamer-air-image',
    labelZh: '蒸汽机 Air-Image',
    description: '高质量艺术创作与插画设计',
    endpoint: 'musesteamer',
  },
  {
    modelName: 'ernie-image-turbo',
    labelZh: 'ERNIE Image Turbo',
    description: '商业海报、漫画、多面板布局，强指令跟随',
    endpoint: 'generations',
  },
  {
    modelName: 'qwen-image',
    labelZh: 'Qwen Image',
    description: '高质量文字渲染与创意设计',
    endpoint: 'generations',
  },
]

export const DEFAULT_QIANFAN_IMAGE_MODEL_ID = 'qianfan:flux.1-schnell'

function formatPriceLabel(yuan: number): string {
  const text = yuan < 0.01 ? yuan.toFixed(4) : yuan < 1 ? yuan.toFixed(2) : yuan.toFixed(2)
  return `¥${text}/张`
}

function toCatalogOption(def: QianfanImageModelDef): MomentsImageModelOption {
  const priceYuan = QIANFAN_IMAGE_PRICE_YUAN[def.modelName] ?? null
  const priceLabel = priceYuan != null ? formatPriceLabel(priceYuan) : '价格未知'
  return {
    id: `qianfan:${def.modelName}`,
    modelName: def.modelName,
    labelZh: def.labelZh,
    title: def.labelZh,
    brand: '百度千帆',
    description: `文生图 · ${priceLabel} · ${def.description}`,
    free: false,
    priceYuanPerImage: priceYuan,
    priceLabel,
  }
}

/** 千帆无动态模型列表 API，返回官方静态目录（含定价） */
export function fetchQianfanImageModelCatalog(_apiKey?: string): Promise<MomentsImageModelOption[]> {
  return Promise.resolve(QIANFAN_IMAGE_MODEL_DEFS.map(toCatalogOption))
}

export function isQianfanMuseSteamerModel(modelName: string): boolean {
  return modelName === 'musesteamer-air-image'
}
