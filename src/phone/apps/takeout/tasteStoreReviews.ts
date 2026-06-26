import type { StoreReview } from './types'

type ReviewSeed = {
  author: string
  rating: number
  text: string
  daysAgo: number
}

function formatReviewDate(daysAgo: number): string {
  const d = new Date('2026-03-15T12:00:00')
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sentimentScore(text: string): number {
  if (
    /失望|糟糕|不敢|退款|洒|漏|送错|变质|发酸|异味|温凉|结块|没敢|不会再|差距|不值|回复慢|没回复|基本没法|体验很差|体验糟糕|沟通.*差|否认|漏洒|发酸|有明显复热|没敢吃|没敢继续/.test(
      text,
    )
  ) {
    return 0
  }
  if (
    /一般|中规中矩|没有特别|合格线|看心情|略贵|偏贵|性价比一般|凑单|波动|区别不大|没有到|不会频繁|才比较合理|没有踩雷也没有惊喜|没有到必/.test(
      text,
    )
  ) {
    return 1
  }
  return 2
}

/** 50 档星级，总和 225 → 均分 4.5 */
const TARGET_RATING_LADDER: number[] = [
  1.5, 2, 3, 3, 3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4, 4, 4.5, 4.5, 4.5, 4.5, 4.5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
]

function assignRatingsNear45(seeds: ReviewSeed[]): ReviewSeed[] {
  if (seeds.length !== TARGET_RATING_LADDER.length) {
    return seeds
  }
  const indexed = seeds.map((s, i) => ({ s, i, score: sentimentScore(s.text) }))
  indexed.sort((a, b) => a.score - b.score || a.i - b.i)
  const rated = [...seeds]
  indexed.forEach((entry, rank) => {
    rated[entry.i] = { ...entry.s, rating: TARGET_RATING_LADDER[rank]! }
  })
  return rated
}

function seedsToReviews(prefix: string, seeds: ReviewSeed[]): StoreReview[] {
  const rated = assignRatingsNear45(seeds)
  return rated.map((s, i) => ({
    id: `${prefix}-r${String(i + 1).padStart(3, '0')}`,
    author: s.author,
    rating: s.rating,
    text: s.text,
    date: formatReviewDate(s.daysAgo),
  }))
}

const CONGEE_REVIEW_SEEDS: ReviewSeed[] = [
  { author: '早起人', rating: 5, text: '皮蛋瘦肉粥很稠，米粒开花。小笼包送到还是热的，配粥刚好。', daysAgo: 4 },
  { author: '阿禾', rating: 5, text: '海鲜鲜虾粥料足，虾很新鲜。杂粮粥适合当晚餐，不撑。', daysAgo: 18 },
  { author: '周周', rating: 4.5, text: '起送价友好，面点和粥可以凑单。配送整体稳定。', daysAgo: 35 },
  { author: '老张', rating: 5, text: '南瓜排骨粥熬得很烂，排骨也软。冬天点这个太舒服了。', daysAgo: 7 },
  { author: 'Momo', rating: 4, text: '香菇青菜粥清淡，适合没胃口的时候。就是量偏少一点。', daysAgo: 22 },
  { author: '小林', rating: 5, text: '鲜肉小笼包汤汁多，底还不硬。连着点了一周早餐。', daysAgo: 11 },
  { author: '路人甲', rating: 2, text: '这次配送晚了二十多分钟，粥到手已经温凉，体验很差。', daysAgo: 9 },
  { author: '阿宁', rating: 1, text: '海鲜粥里有两只虾颜色不对，没敢吃。联系商家回复很慢。', daysAgo: 41 },
  { author: '西西', rating: 4.5, text: '银耳莲子百合粥甜度刚好，女生应该会喜欢。', daysAgo: 15 },
  { author: '大刘', rating: 3, text: '味道还行，但感觉和楼下粥店差别不大，性价比一般。', daysAgo: 28 },
  { author: '橙子', rating: 5, text: '红枣桂圆黑米粥很暖，姨妈期点这个刚好。', daysAgo: 6 },
  { author: 'K.', rating: 2.5, text: '酱肉大包有点腻，粥也偏咸，不太合我口味。', daysAgo: 33 },
  { author: '晚风', rating: 4, text: '山药排骨粥料挺实在，就是配送费加上去略贵。', daysAgo: 19 },
  { author: '小七', rating: 5, text: '玉米胡萝卜瘦肉粥孩子愿意喝，会再点。', daysAgo: 13 },
  { author: 'Chen', rating: 3, text: '一般般吧，没有特别惊艳，凑单才点的。', daysAgo: 44 },
  { author: '面控', rating: 4.5, text: '葱花卷香，茶叶蛋入味。配粥是一顿完整早餐。', daysAgo: 8 },
  { author: '匿名', rating: 2, text: '包装漏了，袋子底部油渍，粥洒出来小半盒。', daysAgo: 26 },
  { author: '阿杰', rating: 4, text: '莲子芡实养生粥不错，晚上吃也不觉得负担重。', daysAgo: 17 },
  { author: 'Luna', rating: 5, text: '紫薯燕麦粥颜色好看，口感绵密，拍照也上镜。', daysAgo: 5 },
  { author: '老王', rating: 3.5, text: '蔬菜鸡蛋煎饼可以，但送过来有点软了，影响口感。', daysAgo: 31 },
  { author: '糖纸', rating: 4.5, text: '韭菜鸡蛋包热乎，豆沙包不太甜，老人也能吃。', daysAgo: 14 },
  { author: 'Yo', rating: 1.5, text: '等了一个小时才送到，粥都结块了，这次真的失望。', daysAgo: 52 },
  { author: '小满', rating: 5, text: '养生杂粮粥料多，能吃到各种谷物，很健康。', daysAgo: 3 },
  { author: '阿Ken', rating: 4, text: '凉拌黄瓜清爽，夏天配粥刚好。', daysAgo: 21 },
  { author: '七七', rating: 3, text: '起送门槛虽然不高，但想凑满减还是要点多份。', daysAgo: 38 },
  { author: '北岛', rating: 4.5, text: '红糖发糕松软，不太甜，当下午茶也行。', daysAgo: 10 },
  { author: '叶子', rating: 2, text: '小笼包皮破了，汤汁全漏在盒子里，基本没法吃。', daysAgo: 24 },
  { author: 'Sue', rating: 5, text: '皮蛋瘦肉粥一直是我的首选，这家的肉量算多的。', daysAgo: 2 },
  { author: '路人乙', rating: 4, text: '整体满意，就是高峰期配送会慢一些。', daysAgo: 16 },
  { author: '阿澄', rating: 3.5, text: '粥品在线，面点普通，建议主攻粥类。', daysAgo: 29 },
  { author: '木子', rating: 5, text: '南瓜小米粥很细，胃不舒服时点这个没负担。', daysAgo: 12 },
  { author: 'T.', rating: 2, text: '觉得份量比图片小，男生可能不够吃。', daysAgo: 47 },
  { author: '小赵', rating: 4.5, text: '海鲜鲜虾粥鲜度可以，就是价格略高。', daysAgo: 20 },
  { author: '阿May', rating: 4, text: '茶叶蛋卤得入味，搭配粥很省心的一餐。', daysAgo: 27 },
  { author: '黑猫', rating: 1, text: '点的两碗粥送错成一份，沟通半天才补送，体验糟糕。', daysAgo: 58 },
  { author: 'Echo', rating: 5, text: '莲子芡实养生粥回购三次了，晚上喝助眠。', daysAgo: 1 },
  { author: '大白', rating: 3, text: '味道合格，但没有到必点程度，看心情吧。', daysAgo: 36 },
  { author: '阿南', rating: 4.5, text: '包装严实，雨天也没洒，细节做得不错。', daysAgo: 23 },
  { author: '小圆', rating: 2.5, text: '粥偏稀，和我理解的「现熬稠粥」有差距。', daysAgo: 40 },
  { author: 'Leo', rating: 5, text: '鲜肉小笼包是招牌，底脆汤鲜，强烈推荐。', daysAgo: 6 },
  { author: '匿名用户', rating: 4, text: '适合加班后点一份，热乎的吃起来治愈。', daysAgo: 30 },
  { author: '阿九', rating: 3.5, text: '优惠券力度一般，满减后价格才比较合理。', daysAgo: 42 },
  { author: '糯米', rating: 5, text: '山药排骨粥排骨给得大方，汤也清。', daysAgo: 8 },
  { author: 'Kay', rating: 2, text: '凉拌黄瓜有点咸，粥也偏淡，整体不协调。', daysAgo: 34 },
  { author: '小周', rating: 4.5, text: '紫薯燕麦粥健身后吃刚好，不太甜。', daysAgo: 14 },
  { author: '阿灰', rating: 4, text: '配送员态度好，准时，会再试其他粥品。', daysAgo: 25 },
  { author: '豆包', rating: 3, text: '中规中矩，没有踩雷也没有惊喜。', daysAgo: 49 },
  { author: '南风', rating: 5, text: '红枣桂圆黑米粥女生友好，甜度控制得好。', daysAgo: 4 },
  { author: 'Rui', rating: 1.5, text: '面点有明显复热感，不像现蒸，不会再点。', daysAgo: 55 },
  { author: '小茶', rating: 4.5, text: '皮蛋瘦肉粥和酱肉大包组合，一顿很饱。', daysAgo: 11 },
]

const DESSERT_REVIEW_SEEDS: ReviewSeed[] = [
  { author: '小满', rating: 5, text: '杨枝甘露冰酪层次很丰富，芒果新鲜。绵绵冰入口即化，不会齁甜。', daysAgo: 3 },
  { author: 'Lily', rating: 5, text: '芋泥波波冰沙碗份量足，配送很快。包装防融做得不错。', daysAgo: 19 },
  { author: '阿Ken', rating: 4.5, text: '鲜饮搭配冰品刚好，芒果千层建议两人分。会回购。', daysAgo: 37 },
  { author: '糖纸', rating: 5, text: '奥利奥芝士绵绵冰是本命，每次必点。', daysAgo: 5 },
  { author: 'Momo', rating: 4, text: '抹茶红豆雪山冰抹茶味正，红豆略硬了一点点。', daysAgo: 14 },
  { author: '阿澄', rating: 2, text: '送到时冰已经化了不少，口感大打折扣，夏天真的看运气。', daysAgo: 11 },
  { author: '路人甲', rating: 1, text: '芒果千层奶油发酸，不敢继续吃，已申请退款。', daysAgo: 48 },
  { author: '西西', rating: 4.5, text: '黑糖珍珠鲜奶冰珍珠Q弹，甜度可以备注调整，贴心。', daysAgo: 8 },
  { author: '大刘', rating: 3, text: '味道还行，但价格偏贵，偶尔解馋可以。', daysAgo: 26 },
  { author: '橙子', rating: 5, text: '桃桃气泡冻冻冰很夏天，拍照也好看。', daysAgo: 6 },
  { author: 'K.', rating: 2.5, text: '芋泥肉松盒子芋泥偏干，和预期不太一样。', daysAgo: 33 },
  { author: '晚风', rating: 4, text: '草莓芝士冰沙杯水果新鲜，就是量对男生略少。', daysAgo: 21 },
  { author: '小七', rating: 5, text: '芒果西米露冰碗料足，西米煮得刚好。', daysAgo: 2 },
  { author: 'Chen', rating: 3.5, text: '整体不错，但高峰期要等比较久，冰品化得快。', daysAgo: 40 },
  { author: '面控', rating: 4.5, text: '酒酿小圆子冰沙甜而不腻，女生应该会爱。', daysAgo: 12 },
  { author: '匿名', rating: 2, text: '外卖盒盖没扣紧，送到洒了一半，心情全无。', daysAgo: 29 },
  { author: '阿杰', rating: 4, text: '薄荷柠檬冰爽茶解腻，配绵绵冰刚好。', daysAgo: 17 },
  { author: 'Luna', rating: 5, text: '榴莲班戟榴莲味浓，爱好者可冲。', daysAgo: 7 },
  { author: '老王', rating: 3, text: '一般般，没有到惊艳，路过可试。', daysAgo: 44 },
  { author: '糖纸', rating: 4.5, text: '奶油草莓雪媚娘皮软，草莓酸甜，好评。', daysAgo: 15 },
  { author: 'Yo', rating: 1.5, text: '等太久，冰沙化成奶昔了，这次体验很差。', daysAgo: 51 },
  { author: '小满', rating: 5, text: '芒椰奶西冻冻杯椰香明显，层次清楚。', daysAgo: 4 },
  { author: '阿Ken', rating: 4, text: '青提柠檬茶清爽，夏天标配。', daysAgo: 22 },
  { author: '七七', rating: 3, text: '优惠券要用满减才划算，单品略贵。', daysAgo: 35 },
  { author: '北岛', rating: 4.5, text: '椰奶冻糕入口即化，不太甜，适合控糖。', daysAgo: 9 },
  { author: '叶子', rating: 2, text: '百香果三响炮偏酸，个人喝不惯，可能适合爱酸的人。', daysAgo: 28 },
  { author: 'Sue', rating: 5, text: '奥利奥芝士绵绵冰回购N次，真的好吃。', daysAgo: 1 },
  { author: '路人乙', rating: 4, text: '包装有冰袋，距离近的话状态不错。', daysAgo: 16 },
  { author: '阿澄', rating: 3.5, text: '冰品在线，轻甜盒子普通，建议点招牌冰。', daysAgo: 31 },
  { author: '木子', rating: 5, text: '紫米奶酪三明治意外好吃，当小食刚好。', daysAgo: 10 },
  { author: 'T.', rating: 2, text: '觉得图片和实物差距大，芒果量少。', daysAgo: 46 },
  { author: '小赵', rating: 4.5, text: '蜜桃乌龙气泡水香气好，配冰品解腻。', daysAgo: 18 },
  { author: '阿May', rating: 4, text: '原味麻薯小包软糯，当加购不错。', daysAgo: 24 },
  { author: '黑猫', rating: 1, text: '送错口味还不承认，沟通体验非常差。', daysAgo: 57 },
  { author: 'Echo', rating: 5, text: '杨枝甘露冰酪招牌实至名归，强烈推荐。', daysAgo: 2 },
  { author: '大白', rating: 3, text: '合格线以上，但没有到必吃榜程度。', daysAgo: 38 },
  { author: '阿南', rating: 4.5, text: '鲜榨橙汁真材实料，不是粉冲的。', daysAgo: 13 },
  { author: '小圆', rating: 2.5, text: '绵绵冰细度不够，有点冰渣感。', daysAgo: 42 },
  { author: 'Leo', rating: 5, text: '芋泥波波冰沙碗芋泥香，波波也好吃。', daysAgo: 5 },
  { author: '匿名用户', rating: 4, text: '适合闺蜜下午茶，颜值和味道都在线。', daysAgo: 27 },
  { author: '阿九', rating: 3.5, text: '甜度整体偏高，备注少糖会好一些。', daysAgo: 39 },
  { author: '糯米', rating: 5, text: '芒果千层层次好，奶油不腻，生日可点。', daysAgo: 8 },
  { author: 'Kay', rating: 2, text: '配送慢导致冰品状态差，建议近距再点。', daysAgo: 34 },
  { author: '小周', rating: 4.5, text: '黑糖珍珠鲜奶冰珍珠给得多，性价比高。', daysAgo: 14 },
  { author: '阿灰', rating: 4, text: '整体满意，希望多出低糖选项。', daysAgo: 23 },
  { author: '豆包', rating: 3, text: '中规中矩，解馋可以，不会频繁回购。', daysAgo: 50 },
  { author: '南风', rating: 5, text: '桃桃气泡冻冻冰颜值口味双在线。', daysAgo: 3 },
  { author: 'Rui', rating: 1.5, text: '芋泥肉松盒子有异味，没敢吃完。', daysAgo: 54 },
  { author: '小茶', rating: 4.5, text: '抹茶红豆雪山冰抹茶控可冲，略偏甜。', daysAgo: 11 },
  { author: '阿Lee', rating: 4, text: '四星好评，高峰时段建议近单，冰品状态更好。', daysAgo: 20 },
]

const WESTERN_REVIEW_SEEDS: ReviewSeed[] = [
  { author: 'Luna', rating: 5, text: 'M9 和牛西冷熟度刚好，肉香很足。纪念日点这个没失望。', daysAgo: 3 },
  { author: '老周', rating: 5, text: '香煎法式鹅肝入口即化，配餐包刚好。包装保温做得不错。', daysAgo: 8 },
  { author: '阿Ken', rating: 4.5, text: '干式熟成战斧份量足，两人分刚好。就是配送时间偏长。', daysAgo: 14 },
  { author: 'Yuki', rating: 5, text: '白兰地菲力嫩，酱汁不会盖过肉味。会回购。', daysAgo: 5 },
  { author: 'Chen', rating: 3, text: '整体还可以，但价格真的不便宜，偶尔吃一顿还行。', daysAgo: 22 },
  { author: '路人甲', rating: 2, text: '牛排送到比预期晚，复热感明显，没有堂食那种香。', daysAgo: 31 },
  { author: 'Momo', rating: 4, text: '松露蘑菇浓汤浓郁，餐前喝一碗很满足。', daysAgo: 11 },
  { author: '阿澄', rating: 1.5, text: '鹅肝有腥味，不敢吃完。联系客服处理很慢。', daysAgo: 45 },
  { author: '西西', rating: 5, text: '香草焗蓝龙肉质弹，黄油香克制。高端外送里算能打。', daysAgo: 6 },
  { author: '大刘', rating: 3.5, text: '红酒油封鸭胸不错，但起送价高，得凑单。', daysAgo: 19 },
  { author: '橙子', rating: 4.5, text: '莓果巴斯克流心状态好，餐后收尾完美。', daysAgo: 9 },
  { author: 'K.', rating: 2, text: '意面送到有点坨，罗勒香气也淡了，略失望。', daysAgo: 28 },
  { author: '晚风', rating: 5, text: '香煎银鳕鱼皮脆肉嫩，柠檬黄油汁解腻。', daysAgo: 4 },
  { author: '小七', rating: 4, text: '伊比利亚肋排焦香，就是略偏油，建议配沙拉。', daysAgo: 16 },
  { author: '匿名', rating: 2.5, text: '图片看着很大份，实物主菜偏小，性价比一般。', daysAgo: 37 },
  { author: '阿杰', rating: 4.5, text: '腌北极贝薄片新鲜，前菜摆盘也好看。', daysAgo: 12 },
  { author: '糖纸', rating: 5, text: '巧克力熔岩温热上桌，切开会流心，治愈。', daysAgo: 2 },
  { author: '老王', rating: 3, text: '中规中矩的法餐外卖，没有到惊艳。', daysAgo: 42 },
  { author: 'Sue', rating: 5, text: '低温卤牛舌厚切，软而不烂，口感高级。', daysAgo: 7 },
  { author: 'Yo', rating: 1.5, text: '等了一个多小时，汤都凉了，这次体验很差。', daysAgo: 53 },
  { author: '北岛', rating: 4, text: '白酒焖青口干净，没有沙，配白葡萄酒想象满分。', daysAgo: 18 },
  { author: '叶子', rating: 4.5, text: '松露火腿沙拉清爽，适合搭配主菜解腻。', daysAgo: 10 },
  { author: 'Echo', rating: 5, text: '南瓜栗子金汤细腻，秋天点很应季。', daysAgo: 13 },
  { author: '大白', rating: 3.5, text: '味道在线，但配送费加起送，一顿下来不便宜。', daysAgo: 25 },
  { author: '阿南', rating: 4, text: '香草焗蜗牛黄油香，接受度比想象中高。', daysAgo: 21 },
  { author: '小圆', rating: 2, text: '战斧牛排切法不对，有几块筋咬不动。', daysAgo: 34 },
  { author: 'Leo', rating: 5, text: '龙虾清汤鲜，没有乱加奶油，很法。', daysAgo: 5 },
  { author: 'Kay', rating: 3, text: '提拉米苏偏甜，主菜反而更出彩。', daysAgo: 30 },
  { author: '小赵', rating: 4.5, text: '罗勒大虾意面虾大，番茄底平衡。', daysAgo: 15 },
  { author: '黑猫', rating: 1, text: '送错成鸭胸，沟通体验非常差，不会再点。', daysAgo: 56 },
  { author: '豆包', rating: 4, text: '适合约会餐外送，氛围靠摆盘也撑得住。', daysAgo: 20 },
  { author: '南风', rating: 5, text: '菲力五分熟完美，刀叉都配了，细节好。', daysAgo: 1 },
  { author: 'Rui', rating: 2, text: '鳕鱼有点腥，可能是配送时间太长。', daysAgo: 39 },
  { author: '小茶', rating: 4.5, text: '整体四星半，主菜稳定，汤品略普通。', daysAgo: 17 },
  { author: '阿May', rating: 4, text: '纪念日套餐概念不错，希望出双人组合。', daysAgo: 24 },
  { author: 'T.', rating: 3, text: '合格线以上，但没有到必吃榜，看预算。', daysAgo: 48 },
  { author: '木子', rating: 5, text: '和牛西冷油脂香，配黑椒刚好，强烈推荐。', daysAgo: 3 },
  { author: '路人乙', rating: 4, text: '包装像礼盒，送人有面子。', daysAgo: 26 },
  { author: '阿九', rating: 3.5, text: '优惠券门槛高，得点主菜才划算。', daysAgo: 33 },
  { author: '糯米', rating: 5, text: '鹅肝+菲力组合，一顿下来很满足。', daysAgo: 8 },
  { author: '小周', rating: 4.5, text: 'Basque 巴斯克名不虚传，配咖啡想象满分。', daysAgo: 11 },
  { author: '阿灰', rating: 4, text: '整体满意，建议近距点，状态更好。', daysAgo: 23 },
  { author: '七七', rating: 3, text: '法餐外卖终究有上限，主菜还行前菜一般。', daysAgo: 41 },
  { author: '面控', rating: 5, text: '干式熟成战斧香味独特，懂吃的会喜欢。', daysAgo: 6 },
  { author: '匿名用户', rating: 2, text: '盒盖没扣紧，汤洒了，心情全无。', daysAgo: 27 },
  { author: '阿Lee', rating: 4.5, text: 'Mirra 觅芮算是寻味里最高级的一档，值得试。', daysAgo: 14 },
  { author: '小满', rating: 5, text: '蓝龙和银鳕鱼都点过，海鲜线稳定。', daysAgo: 4 },
  { author: 'Lily', rating: 4, text: '肋排焦边好，就是配送慢，要预留时间。', daysAgo: 19 },
  { author: '周周', rating: 5, text: '牛舌低温处理真的软，配酒绝配。', daysAgo: 9 },
  { author: '老张', rating: 4.5, text: '鸭胸皮脆，红酒汁不抢味，法式那味儿对了。', daysAgo: 12 },
]

const JAPANESE_REVIEW_SEEDS: ReviewSeed[] = [
  { author: '小鱼', rating: 5, text: '厚切三文鱼刺身很新鲜，纹理漂亮，配芥末刚好。', daysAgo: 2 },
  { author: '阿Ken', rating: 5, text: '和牛寿喜烧锅汤底甜鲜，肥牛片量大，冬天点很治愈。', daysAgo: 5 },
  { author: 'Yuki', rating: 4.5, text: '三文鱼握寿司醋饭温度对，鱼生不软烂，会回购。', daysAgo: 8 },
  { author: 'Momo', rating: 5, text: '蒲烧鳗鱼卷鳗鱼肉厚，酱汁不会过甜，招牌没错。', daysAgo: 3 },
  { author: 'Chen', rating: 4, text: '豚骨拉面汤浓面劲，就是送到略晚，面稍微涨了一点。', daysAgo: 14 },
  { author: '路人甲', rating: 2, text: '刺身送到有点温了，不敢多吃，体验一般。', daysAgo: 29 },
  { author: '西西', rating: 5, text: '北极贝刺身弹牙，甜感明显，比很多日料外卖新鲜。', daysAgo: 6 },
  { author: '大刘', rating: 3, text: '味道还行，但起送价加上配送费，一顿不算便宜。', daysAgo: 21 },
  { author: '橙子', rating: 4.5, text: '鲜虾天妇罗外酥，虾还弹，配天妇罗汁很正。', daysAgo: 9 },
  { author: 'K.', rating: 2, text: '寿司醋饭偏硬，和堂食差距有点大。', daysAgo: 33 },
  { author: '晚风', rating: 5, text: '鳗鱼丼饭鳗鱼肉铺得满，米饭粒粒分明，一人食刚好。', daysAgo: 4 },
  { author: '小七', rating: 4, text: '照烧鸡腿定食配菜齐全，鸡腿皮焦香，性价比高。', daysAgo: 11 },
  { author: '匿名', rating: 2.5, text: '图片看着很大份，实际刺身片数偏少，略失望。', daysAgo: 38 },
  { author: '阿杰', rating: 4.5, text: '火焰芝士虾卷有轻微炙烤香，芝士不会腻。', daysAgo: 7 },
  { author: '糖纸', rating: 5, text: '抹茶大福软糯，抹茶苦甜平衡，餐后收尾完美。', daysAgo: 1 },
  { author: '老王', rating: 3, text: '中规中矩的日料外卖，没有到惊艳，但也不踩雷。', daysAgo: 40 },
  { author: 'Sue', rating: 5, text: '单人肥牛寿喜饭一人份刚好，肥牛和洋葱很搭。', daysAgo: 10 },
  { author: 'Yo', rating: 1.5, text: '等太久，刺身状态明显下降，这次不太行。', daysAgo: 52 },
  { author: '北岛', rating: 4, text: '芥末章鱼爽脆，开胃小食，配啤酒想象满分。', daysAgo: 16 },
  { author: '叶子', rating: 4.5, text: '蟹籽军舰鱼籽爆珠，醋饭捏得紧实，好看也好吃。', daysAgo: 12 },
  { author: 'Echo', rating: 5, text: '玉子寿司蛋香足，甜口控会爱，小朋友也能吃。', daysAgo: 8 },
  { author: '大白', rating: 3.5, text: '整体在线，但炸物送到会软一点，建议近单。', daysAgo: 24 },
  { author: '阿南', rating: 4, text: '酥脆炸猪排面衣还脆，配卷心菜丝解腻。', daysAgo: 18 },
  { author: '小圆', rating: 2, text: '海鲜寿喜小锅里有只虾不太新鲜，联系商家处理慢。', daysAgo: 35 },
  { author: 'Leo', rating: 5, text: '日式唐扬鸡块多汁，比很多居酒屋外卖好吃。', daysAgo: 5 },
  { author: 'Kay', rating: 3, text: '章鱼小丸子中规中矩，内馅略少，解馋可以。', daysAgo: 27 },
  { author: '小赵', rating: 4.5, text: '溏心温泉蛋流心完美，配拉面或定食都加分。', daysAgo: 13 },
  { author: '黑猫', rating: 1, text: '送错成炸猪排，沟通体验差，不会再点。', daysAgo: 55 },
  { author: '豆包', rating: 4, text: '适合工作日午餐，定食丼出餐快，包装也干净。', daysAgo: 19 },
  { author: '南风', rating: 5, text: '刺身拼盘概念如果有就更好了，单点三文鱼已经满足。', daysAgo: 2 },
  { author: 'Rui', rating: 2, text: '北极贝颜色发暗，没敢吃完，希望品控加强。', daysAgo: 41 },
  { author: '小茶', rating: 4.5, text: '整体四星半，寿司线稳定，拉面略普通。', daysAgo: 15 },
  { author: '阿May', rating: 4, text: '希望出双人刺身套餐，现在凑满减得点不少。', daysAgo: 22 },
  { author: 'T.', rating: 3, text: '合格线以上，刺身新鲜时值得点，看配送距离。', daysAgo: 46 },
  { author: '木子', rating: 5, text: '和牛寿喜烧锅真的香，汤底最后煮乌冬想象满分。', daysAgo: 4 },
  { author: '路人乙', rating: 4, text: '包装有冰袋，刺身到手还是冰的，细节加分。', daysAgo: 25 },
  { author: '阿九', rating: 3.5, text: '优惠券门槛还行，刺身加寿司凑单刚好。', daysAgo: 31 },
  { author: '糯米', rating: 5, text: '鳗鱼卷加三文鱼刺身，一顿下来很满足。', daysAgo: 6 },
  { author: '小周', rating: 4.5, text: '汐鮨算是寻味里日料头牌，刺身品质能打。', daysAgo: 9 },
  { author: '阿灰', rating: 4, text: '整体满意，建议三公里内点，状态更好。', daysAgo: 20 },
  { author: '七七', rating: 3, text: '炸物和刺身混点，炸物会略受影响，分开点更好。', daysAgo: 36 },
  { author: '面控', rating: 5, text: '豚骨拉面汤头浓而不腻，叉烧片也入味。', daysAgo: 7 },
  { author: '匿名用户', rating: 2, text: '盒盖没扣紧，汤洒了，心情全无。', daysAgo: 28 },
  { author: '阿Lee', rating: 4.5, text: '四星好评，高峰时段建议提前点，出餐会慢。', daysAgo: 17 },
  { author: '小满', rating: 5, text: '刺身和寿司都点过，海鲜线稳定，信任。', daysAgo: 3 },
  { author: 'Lily', rating: 4, text: '寿喜锅份量足，就是配送慢，要预留时间。', daysAgo: 14 },
  { author: '周周', rating: 5, text: '火焰芝士虾卷拍照好看，味道也在线。', daysAgo: 8 },
  { author: '老张', rating: 4.5, text: '照烧鸡腿定食酱汁浓，配米饭很下饭。', daysAgo: 11 },
  { author: '阿禾', rating: 4, text: '抹茶大福不甜腻，日料店甜品意外靠谱。', daysAgo: 23 },
  { author: '小林', rating: 5, text: '厚切三文鱼每次点都不踩雷，脂肪线漂亮。', daysAgo: 1 },
]

export function buildCongeeStoreReviews(): StoreReview[] {
  return seedsToReviews('zm', CONGEE_REVIEW_SEEDS)
}

export function buildDessertStoreReviews(): StoreReview[] {
  return seedsToReviews('wf', DESSERT_REVIEW_SEEDS)
}

export function buildWesternStoreReviews(): StoreReview[] {
  return seedsToReviews('mr', WESTERN_REVIEW_SEEDS)
}

export function buildJapaneseStoreReviews(): StoreReview[] {
  return seedsToReviews('ss', JAPANESE_REVIEW_SEEDS)
}

const THAI_REVIEW_SEEDS: ReviewSeed[] = [
  { author: '小柠', rating: 5, text: '泰式冬阴功汤酸辣刚好，虾也新鲜，冬天点这一碗太治愈。', daysAgo: 3 },
  { author: '阿May', rating: 5, text: '经典泰式炒河粉锅气足，花生碎和青柠一挤，味道立刻完整。', daysAgo: 6 },
  { author: '南风', rating: 4.5, text: '芒果糯米饭椰香浓，糯米软糯不粘牙，当收尾刚好。', daysAgo: 9 },
  { author: 'Echo', rating: 5, text: '绿咖喱鸡肉椰浆底很香，辣度对我刚好，配米饭两碗。', daysAgo: 2 },
  { author: 'Chen', rating: 4, text: '菠萝炒饭粒粒分明，菠萝块甜，就是份量略少。', daysAgo: 14 },
  { author: '路人甲', rating: 2, text: '冬阴功送到有点温了，酸辣感弱了一截，略失望。', daysAgo: 28 },
  { author: '西西', rating: 5, text: '红咖喱大虾虾肉弹，咖喱汁拌饭绝了。', daysAgo: 5 },
  { author: '大刘', rating: 3, text: '味道在线，但起送加上配送费，一顿不算便宜。', daysAgo: 22 },
  { author: '橙子', rating: 4.5, text: '青木瓜沙拉爽脆酸辣，夏天点很开胃。', daysAgo: 11 },
  { author: 'K.', rating: 2, text: '炒河粉略油，吃到后面有点腻。', daysAgo: 35 },
  { author: '晚风', rating: 5, text: '椰香鸡饭一人份刚好，鸡肉嫩，饭也入味。', daysAgo: 4 },
  { author: '小七', rating: 4, text: '黄咖喱牛腩软烂，土豆吸满咖喱汁，下饭。', daysAgo: 16 },
  { author: '匿名', rating: 2.5, text: '图片看着很大份，实际咖喱肉偏少。', daysAgo: 40 },
  { author: '阿杰', rating: 4.5, text: '黑椒老虎虾个头可以，黑椒味不抢海鲜本味。', daysAgo: 8 },
  { author: '糖纸', rating: 5, text: '椰奶西米露甜度克制，餐后清口。', daysAgo: 1 },
  { author: '老王', rating: 3, text: '中规中矩的泰餐外卖，没有到惊艳但也不踩雷。', daysAgo: 38 },
  { author: 'Sue', rating: 5, text: '香茅炒鸡香茅味足，鸡肉不柴，很泰。', daysAgo: 7 },
  { author: 'Yo', rating: 1.5, text: '等太久，汤洒了一半，这次体验差。', daysAgo: 50 },
  { author: '北岛', rating: 4, text: '酸辣凤爪啃着过瘾，追剧配餐合适。', daysAgo: 19 },
  { author: '叶子', rating: 4.5, text: '鲜虾酸辣沙拉虾新鲜，酱汁是灵魂。', daysAgo: 12 },
  { author: 'Momo', rating: 5, text: '玛莎曼咖喱猪花生香气明显，和绿咖喱不一样，值得试。', daysAgo: 10 },
  { author: '大白', rating: 3.5, text: '整体不错，炸物类建议近单，远了会软。', daysAgo: 24 },
  { author: '阿南', rating: 4, text: '椒盐鱿鱼外酥，配甜辣酱很搭。', daysAgo: 17 },
  { author: '小圆', rating: 2, text: '罗勒爆炒牛肉有点老，联系商家处理慢。', daysAgo: 33 },
  { author: 'Leo', rating: 5, text: '酸辣青柠汤比冬阴功更清爽，夏天常点。', daysAgo: 5 },
  { author: 'Kay', rating: 3, text: '香茅牛肉沙拉中规中矩，解腻可以。', daysAgo: 26 },
  { author: '小赵', rating: 4.5, text: '椰香鸡汤暖，料也实在，感冒期点很安慰。', daysAgo: 13 },
  { author: '黑猫', rating: 1, text: '送错成绿咖喱，沟通体验差，不会再点。', daysAgo: 52 },
  { author: '豆包', rating: 4, text: '工作日午餐友好，河粉加沙拉凑满减刚好。', daysAgo: 18 },
  { author: 'Rui', rating: 2, text: '虾颜色发暗，没敢吃完，希望品控加强。', daysAgo: 42 },
  { author: '小茶', rating: 4.5, text: '青柠屿算是寻味里泰餐头牌，咖喱线稳定。', daysAgo: 15 },
  { author: 'T.', rating: 3, text: '合格线以上，三公里内点状态更好。', daysAgo: 44 },
  { author: '木子', rating: 5, text: '冬阴功加炒河粉，一顿下来酸辣满足。', daysAgo: 4 },
  { author: '路人乙', rating: 4, text: '包装严实，汤有单独分装，细节加分。', daysAgo: 23 },
  { author: '阿九', rating: 3.5, text: '优惠券门槛友好，两人凑单划算。', daysAgo: 30 },
  { author: '糯米', rating: 5, text: '芒果糯米饭每次必点，椰浆淋多一点更好。', daysAgo: 6 },
  { author: '小周', rating: 4.5, text: '泰式风味层次清楚，不是那种只会堆辣。', daysAgo: 9 },
  { author: '阿灰', rating: 4, text: '整体满意，高峰建议提前点。', daysAgo: 20 },
  { author: '七七', rating: 3, text: '咖喱和沙拉混点，咖喱汁会略影响沙拉口感。', daysAgo: 34 },
  { author: '面控', rating: 5, text: '炒河粉宽粉有嚼劲，豆芽脆，很正。', daysAgo: 7 },
  { author: '匿名用户', rating: 2, text: '盒盖没扣紧，咖喱洒了，心情全无。', daysAgo: 27 },
  { author: '阿Lee', rating: 4.5, text: '四星半好评，出餐速度比预期快。', daysAgo: 16 },
  { author: '小满', rating: 5, text: '冬阴功和绿咖喱都点过，汤咖喱线都稳。', daysAgo: 3 },
  { author: 'Lily', rating: 4, text: '份量足，就是配送略慢，要预留时间。', daysAgo: 14 },
  { author: '周周', rating: 5, text: '菠萝炒饭拍照好看，味道也在线。', daysAgo: 8 },
  { author: '老张', rating: 4.5, text: '红咖喱大虾配椰香鸡饭，两人分刚好。', daysAgo: 11 },
  { author: '阿禾', rating: 4, text: '椰奶西米露不甜腻，女生应该会喜欢。', daysAgo: 21 },
  { author: '小林', rating: 5, text: '冬阴功每次点都不踩雷，香茅味很正。', daysAgo: 1 },
  { author: 'Kayla', rating: 4, text: '希望出双人套餐，现在凑满减要点不少。', daysAgo: 25 },
  { author: '阿宁', rating: 5, text: '青柠屿的酸辣平衡做得好，不会只会堆辣椒。', daysAgo: 2 },
  { author: '小V', rating: 4.5, text: '寻味里少有的泰餐，换口味首选。', daysAgo: 10 },
  { author: '豆花', rating: 3, text: '略偏贵，但味道对得起，偶尔点。', daysAgo: 36 },
  { author: '阿峰', rating: 5, text: '香茅炒鸡加冬阴功，一人食完美组合。', daysAgo: 5 },
]

export function buildThaiStoreReviews(): StoreReview[] {
  return seedsToReviews('qt', THAI_REVIEW_SEEDS)
}

/** 根据评价列表计算综合评分（保留一位小数） */
export function averageReviewRating(reviews: StoreReview[]): number {
  if (!reviews.length) return 0
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}
