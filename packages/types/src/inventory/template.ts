export interface InventoryTemplateItem {
  key: string
  category: string
  group: string
  name: string
  unit: string
  warnBelow: number
}

export interface InventoryTemplateGroup {
  key: string
  items: InventoryTemplateItem[]
}

export interface InventoryTemplateCategory {
  key: string
  groups: InventoryTemplateGroup[]
}

function item(category: string, group: string, key: string, name: string, unit: string, warnBelow: number): InventoryTemplateItem {
  return { category, group, key, name, unit, warnBelow }
}

export const INVENTORY_TEMPLATE: InventoryTemplateCategory[] = [
  {
    key: 'food',
    groups: [
      {
        key: 'protein',
        items: [
          item('food', 'protein', 'food-protein-eggs', '鸡蛋', '个', 6),
          item('food', 'protein', 'food-protein-chicken', '鸡肉', 'kg', 1),
          item('food', 'protein', 'food-protein-beef', '牛肉', 'kg', 1),
          item('food', 'protein', 'food-protein-pork', '猪肉', 'kg', 1),
          item('food', 'protein', 'food-protein-fish', '鱼肉', 'kg', 1),
          item('food', 'protein', 'food-protein-canned', '罐头肉类', '罐', 4),
          item('food', 'protein', 'food-protein-beans', '豆类/豆制品', '份', 2),
        ],
      },
      {
        key: 'produce',
        items: [
          item('food', 'produce', 'food-produce-vegetables', '蔬菜', '份', 3),
          item('food', 'produce', 'food-produce-fruit', '水果', '份', 3),
          item('food', 'produce', 'food-produce-storage', '洋葱/土豆等耐储蔬菜', 'kg', 2),
          item('food', 'produce', 'food-produce-frozen', '冷冻蔬果', '包', 1),
        ],
      },
      {
        key: 'seasoning',
        items: [
          item('food', 'seasoning', 'food-seasoning-salt', '盐', '瓶', 1),
          item('food', 'seasoning', 'food-seasoning-sugar', '糖', '包', 1),
          item('food', 'seasoning', 'food-seasoning-oil', '食用油', '瓶', 1),
          item('food', 'seasoning', 'food-seasoning-soy', '酱油', '瓶', 1),
          item('food', 'seasoning', 'food-seasoning-vinegar', '醋', '瓶', 1),
          item('food', 'seasoning', 'food-seasoning-spices', '香料', '套', 1),
          item('food', 'seasoning', 'food-seasoning-sauce', '酱料', '瓶', 1),
        ],
      },
      {
        key: 'snacks',
        items: [
          item('food', 'snacks', 'food-snack-biscuits', '饼干', '包', 2),
          item('food', 'snacks', 'food-snack-bars', '能量棒', '条', 6),
          item('food', 'snacks', 'food-snack-nuts', '坚果', '包', 2),
          item('food', 'snacks', 'food-snack-chocolate', '巧克力', '块', 2),
          item('food', 'snacks', 'food-snack-chips', '薯片/膨化食品', '包', 2),
        ],
      },
    ],
  },
  {
    key: 'drink',
    groups: [
      {
        key: 'drinking_water',
        items: [
          item('drink', 'drinking_water', 'drink-water-bottled', '瓶装水', '瓶', 12),
          item('drink', 'drinking_water', 'drink-water-tank', '桶装水', 'L', 20),
          item('drink', 'drinking_water', 'drink-water-filter', '净水滤芯', '个', 1),
          item('drink', 'drinking_water', 'drink-water-bag', '备用饮水袋', '个', 1),
        ],
      },
      {
        key: 'hot_drinks',
        items: [
          item('drink', 'hot_drinks', 'drink-hot-coffee', '咖啡', '包', 1),
          item('drink', 'hot_drinks', 'drink-hot-tea', '茶', '盒', 1),
          item('drink', 'hot_drinks', 'drink-hot-milk', '奶粉', '包', 1),
          item('drink', 'hot_drinks', 'drink-hot-cocoa', '热巧克力', '包', 1),
        ],
      },
      {
        key: 'sports_drinks',
        items: [
          item('drink', 'sports_drinks', 'drink-sport-electrolyte', '电解质饮料', '瓶', 4),
          item('drink', 'sports_drinks', 'drink-sport-sports', '运动饮料', '瓶', 4),
          item('drink', 'sports_drinks', 'drink-sport-energy', '能量饮料', '瓶', 2),
        ],
      },
      {
        key: 'leisure_drinks',
        items: [
          item('drink', 'leisure_drinks', 'drink-leisure-juice', '果汁', '瓶', 2),
          item('drink', 'leisure_drinks', 'drink-leisure-soda', '苏打水', '瓶', 4),
          item('drink', 'leisure_drinks', 'drink-leisure-beer', '啤酒', '瓶', 0),
          item('drink', 'leisure_drinks', 'drink-leisure-wine', '葡萄酒', '瓶', 0),
        ],
      },
    ],
  },
  {
    key: 'spare_parts',
    groups: [
      {
        key: 'engine',
        items: [
          item('spare_parts', 'engine', 'spare-engine-oil', '机油', 'L', 2),
          item('spare_parts', 'engine', 'spare-engine-fuel-filter', '燃油滤芯', '个', 1),
          item('spare_parts', 'engine', 'spare-engine-oil-filter', '机油滤芯', '个', 1),
          item('spare_parts', 'engine', 'spare-engine-belt', '皮带', '条', 1),
          item('spare_parts', 'engine', 'spare-engine-coolant', '冷却液', 'L', 1),
          item('spare_parts', 'engine', 'spare-engine-impeller', '备用叶轮', '个', 1),
        ],
      },
      {
        key: 'electrical',
        items: [
          item('spare_parts', 'electrical', 'spare-electric-fuse', '保险丝', '个', 6),
          item('spare_parts', 'electrical', 'spare-electric-bulb', '灯泡', '个', 2),
          item('spare_parts', 'electrical', 'spare-electric-battery', '备用电池', '节', 4),
          item('spare_parts', 'electrical', 'spare-electric-wire', '电线', 'm', 2),
          item('spare_parts', 'electrical', 'spare-electric-terminal', '接线端子', '个', 10),
          item('spare_parts', 'electrical', 'spare-electric-cable', '充电线', '条', 2),
        ],
      },
      {
        key: 'hull_deck',
        items: [
          item('spare_parts', 'hull_deck', 'spare-deck-rope', '绳索', '条', 2),
          item('spare_parts', 'hull_deck', 'spare-deck-shackle', '卸扣', '个', 4),
          item('spare_parts', 'hull_deck', 'spare-deck-block', '滑轮', '个', 1),
          item('spare_parts', 'hull_deck', 'spare-deck-tape', '胶带', '卷', 2),
          item('spare_parts', 'hull_deck', 'spare-deck-sealant', '防水胶', '支', 1),
          item('spare_parts', 'hull_deck', 'spare-deck-zip-tie', '扎带', '包', 1),
        ],
      },
      {
        key: 'hardware',
        items: [
          item('spare_parts', 'hardware', 'spare-hardware-screw', '螺丝', '个', 10),
          item('spare_parts', 'hardware', 'spare-hardware-nut', '螺母', '个', 10),
          item('spare_parts', 'hardware', 'spare-hardware-washer', '垫片', '个', 10),
          item('spare_parts', 'hardware', 'spare-hardware-clamp', '卡箍', '个', 2),
          item('spare_parts', 'hardware', 'spare-hardware-hinge', '铰链', '个', 1),
        ],
      },
    ],
  },
  {
    key: 'safety',
    groups: [
      {
        key: 'rescue',
        items: [
          item('safety', 'rescue', 'safety-rescue-lifejacket', '救生衣', '件', 2),
          item('safety', 'rescue', 'safety-rescue-ring', '救生圈', '个', 1),
          item('safety', 'rescue', 'safety-rescue-line', '安全绳', '条', 1),
          item('safety', 'rescue', 'safety-rescue-blanket', '救生毯', '条', 1),
          item('safety', 'rescue', 'safety-rescue-mob-light', '人员落水灯', '个', 1),
        ],
      },
      {
        key: 'first_aid',
        items: [
          item('safety', 'first_aid', 'safety-firstaid-kit', '急救包', '套', 1),
          item('safety', 'first_aid', 'safety-firstaid-bandage', '创可贴', '盒', 1),
          item('safety', 'first_aid', 'safety-firstaid-disinfectant', '消毒液', '瓶', 1),
          item('safety', 'first_aid', 'safety-firstaid-gauze', '绷带', '卷', 2),
          item('safety', 'first_aid', 'safety-firstaid-painkiller', '止痛药', '盒', 1),
          item('safety', 'first_aid', 'safety-firstaid-seasick', '晕船药', '盒', 1),
        ],
      },
      {
        key: 'fire_safety',
        items: [
          item('safety', 'fire_safety', 'safety-fire-extinguisher', '灭火器', '个', 1),
          item('safety', 'fire_safety', 'safety-fire-blanket', '灭火毯', '条', 1),
          item('safety', 'fire_safety', 'safety-fire-smoke', '烟雾报警器', '个', 1),
          item('safety', 'fire_safety', 'safety-fire-co', '一氧化碳报警器', '个', 1),
        ],
      },
      {
        key: 'signals',
        items: [
          item('safety', 'signals', 'safety-signal-flare', '信号弹', '支', 2),
          item('safety', 'signals', 'safety-signal-light', '手持信号灯', '个', 1),
          item('safety', 'signals', 'safety-signal-whistle', '哨子', '个', 1),
          item('safety', 'signals', 'safety-signal-mirror', '反光镜', '个', 1),
          item('safety', 'signals', 'safety-signal-flashlight', '备用手电', '个', 1),
        ],
      },
    ],
  },
  {
    key: 'tools',
    groups: [
      {
        key: 'hand_tools',
        items: [
          item('tools', 'hand_tools', 'tool-hand-screwdriver', '螺丝刀', '把', 1),
          item('tools', 'hand_tools', 'tool-hand-wrench', '扳手', '把', 1),
          item('tools', 'hand_tools', 'tool-hand-plier', '钳子', '把', 1),
          item('tools', 'hand_tools', 'tool-hand-knife', '刀具', '把', 1),
          item('tools', 'hand_tools', 'tool-hand-hammer', '锤子', '把', 1),
          item('tools', 'hand_tools', 'tool-hand-tape-measure', '卷尺', '个', 1),
        ],
      },
      {
        key: 'maintenance_consumables',
        items: [
          item('tools', 'maintenance_consumables', 'tool-consume-glue', '强力胶', '支', 1),
          item('tools', 'maintenance_consumables', 'tool-consume-epoxy', '环氧胶', '套', 1),
          item('tools', 'maintenance_consumables', 'tool-consume-lubricant', '润滑油', '瓶', 1),
          item('tools', 'maintenance_consumables', 'tool-consume-rust', '防锈剂', '瓶', 1),
          item('tools', 'maintenance_consumables', 'tool-consume-sandpaper', '砂纸', '张', 4),
          item('tools', 'maintenance_consumables', 'tool-consume-cloth', '清洁布', '块', 4),
        ],
      },
      {
        key: 'power_tools',
        items: [
          item('tools', 'power_tools', 'tool-power-drill', '电钻', '把', 1),
          item('tools', 'power_tools', 'tool-power-bit', '备用钻头', '套', 1),
          item('tools', 'power_tools', 'tool-power-charger', '充电器', '个', 1),
          item('tools', 'power_tools', 'tool-power-battery', '备用电池包', '块', 1),
        ],
      },
    ],
  },
  {
    key: 'life',
    groups: [
      {
        key: 'cleaning',
        items: [
          item('life', 'cleaning', 'life-clean-bag', '垃圾袋', '卷', 1),
          item('life', 'cleaning', 'life-clean-detergent', '洗洁精', '瓶', 1),
          item('life', 'cleaning', 'life-clean-rag', '抹布', '块', 2),
          item('life', 'cleaning', 'life-clean-sponge', '海绵', '块', 2),
          item('life', 'cleaning', 'life-clean-wipe', '消毒湿巾', '包', 1),
          item('life', 'cleaning', 'life-clean-laundry', '洗衣液', '瓶', 1),
        ],
      },
      {
        key: 'personal_care',
        items: [
          item('life', 'personal_care', 'life-personal-paper', '纸巾', '包', 2),
          item('life', 'personal_care', 'life-personal-wipes', '湿巾', '包', 1),
          item('life', 'personal_care', 'life-personal-sunscreen', '防晒霜', '瓶', 1),
          item('life', 'personal_care', 'life-personal-toothpaste', '牙膏', '支', 1),
          item('life', 'personal_care', 'life-personal-soap', '香皂', '块', 1),
          item('life', 'personal_care', 'life-personal-towel', '毛巾', '条', 2),
        ],
      },
      {
        key: 'kitchen_supplies',
        items: [
          item('life', 'kitchen_supplies', 'life-kitchen-bag', '保鲜袋', '盒', 1),
          item('life', 'kitchen_supplies', 'life-kitchen-film', '保鲜膜', '卷', 1),
          item('life', 'kitchen_supplies', 'life-kitchen-foil', '铝箔纸', '卷', 1),
          item('life', 'kitchen_supplies', 'life-kitchen-tableware', '一次性餐具', '套', 0),
          item('life', 'kitchen_supplies', 'life-kitchen-lighter', '打火机', '个', 1),
          item('life', 'kitchen_supplies', 'life-kitchen-gas', '燃气罐', '罐', 1),
        ],
      },
    ],
  },
  {
    key: 'entertainment',
    groups: [
      {
        key: 'water_activities',
        items: [
          item('entertainment', 'water_activities', 'fun-water-fishing', '钓具', '套', 1),
          item('entertainment', 'water_activities', 'fun-water-snorkel', '浮潜装备', '套', 1),
          item('entertainment', 'water_activities', 'fun-water-goggles', '泳镜', '副', 1),
          item('entertainment', 'water_activities', 'fun-water-fins', '脚蹼', '副', 1),
          item('entertainment', 'water_activities', 'fun-water-inflatable', '充气玩具', '个', 0),
        ],
      },
      {
        key: 'leisure',
        items: [
          item('entertainment', 'leisure', 'fun-leisure-boardgame', '桌游', '盒', 1),
          item('entertainment', 'leisure', 'fun-leisure-card', '扑克牌', '副', 1),
          item('entertainment', 'leisure', 'fun-leisure-book', '书籍', '本', 1),
          item('entertainment', 'leisure', 'fun-leisure-speaker', '音箱', '个', 1),
          item('entertainment', 'leisure', 'fun-leisure-reader', '平板/电子阅读器', '个', 0),
        ],
      },
      {
        key: 'camera_recording',
        items: [
          item('entertainment', 'camera_recording', 'fun-camera-action', '运动相机', '个', 1),
          item('entertainment', 'camera_recording', 'fun-camera-battery', '相机电池', '块', 1),
          item('entertainment', 'camera_recording', 'fun-camera-card', '存储卡', '张', 1),
          item('entertainment', 'camera_recording', 'fun-camera-bag', '防水袋', '个', 1),
          item('entertainment', 'camera_recording', 'fun-camera-tripod', '三脚架', '个', 0),
        ],
      },
    ],
  },
]

export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  food: '食物',
  drink: '饮料',
  spare_parts: '备件',
  safety: '安全',
  tools: '工具',
  life: '生活',
  entertainment: '娱乐',
}

export const INVENTORY_GROUP_LABELS: Record<string, string> = {
  protein: '蛋白',
  produce: '蔬果',
  seasoning: '调味',
  snacks: '零食',
  drinking_water: '饮用水',
  hot_drinks: '热饮',
  sports_drinks: '功能饮料',
  leisure_drinks: '休闲饮品',
  engine: '发动机',
  electrical: '电气',
  hull_deck: '船体与甲板',
  hardware: '五金',
  rescue: '救生',
  first_aid: '急救',
  fire_safety: '消防',
  signals: '信号',
  hand_tools: '手工具',
  maintenance_consumables: '维修耗材',
  power_tools: '电动工具',
  cleaning: '清洁',
  personal_care: '个人用品',
  kitchen_supplies: '厨房用品',
  water_activities: '水上活动',
  leisure: '休闲',
  camera_recording: '摄影记录',
}

export const INVENTORY_CATEGORIES = INVENTORY_TEMPLATE.map((category) => category.key)
