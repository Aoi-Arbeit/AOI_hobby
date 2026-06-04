"""
めんだこRPG ～深海の冒険～
ゲームデータ定義モジュール
"""

# ========== フォントパス ==========
FONT_PATH = "Noto_Sans_JP/static/NotoSansJP-Regular.ttf"
FONT_BOLD = "Noto_Sans_JP/static/NotoSansJP-Bold.ttf"

# ========== カラーパレット（深海テーマ） ==========
COL_BG           = (5,   5,  20)
COL_WIN_BG       = (0,   0,  45)
COL_WIN_BORDER   = (40, 100, 200)
COL_WIN_BORDER2  = (80, 160, 255)
COL_TEXT         = (200, 240, 255)
COL_TEXT_DIM     = (100, 150, 200)
COL_SELECT       = (255, 220,  50)
COL_HP_HIGH      = (30,  200,  60)
COL_HP_MID       = (220, 180,   0)
COL_HP_LOW       = (220,  60,  20)
COL_MP           = (40,  110, 230)
COL_DAMAGE       = (255,  80,  40)
COL_HEAL         = (80,  230, 120)
COL_CRITICAL     = (255, 230,   0)
COL_MISS         = (160, 160, 180)
COL_STATUS_BAD   = (200, 100, 230)
COL_STATUS_GOOD  = (100, 230, 200)
COL_GOLD         = (255, 200,  50)

# ========== スキルデータ ==========
SKILLS = {
    'スミアタック': {
        'mp_cost': 4,
        'type': 'attack',
        'power': 1.5,
        'element': 'water',
        'effect': 'blind',
        'effect_chance': 0.35,
        'target': 'single',
        'color': (20, 60, 200),
        'description': '敵にダメージ＋暗闇',
        'learn_level': 1,
    },
    'ヒレ波動': {
        'mp_cost': 8,
        'type': 'attack',
        'power': 1.2,
        'element': 'water',
        'effect': None,
        'effect_chance': 0,
        'target': 'single',
        'color': (0, 150, 255),
        'description': '強力な水属性攻撃',
        'learn_level': 5,
    },
    '深海の加護': {
        'mp_cost': 8,
        'type': 'heal',
        'power': 40,
        'element': None,
        'effect': None,
        'effect_chance': 0,
        'target': 'self',
        'color': (80, 220, 120),
        'description': 'HPを中量回復する',
        'learn_level': 8,
    },
    'タコシュート': {
        'mp_cost': 14,
        'type': 'attack',
        'power': 2.8,
        'element': 'water',
        'effect': None,
        'effect_chance': 0,
        'target': 'single',
        'color': (0, 200, 255),
        'description': '敵1体に強力ダメージ',
        'learn_level': 12,
    },
    '光の珊瑚術': {
        'mp_cost': 22,
        'type': 'attack',
        'power': 2.0,
        'element': 'light',
        'effect': 'debuff_clear',
        'effect_chance': 1.0,
        'target': 'single',
        'color': (255, 255, 150),
        'description': '強攻撃＋自分のデバフ解除',
        'learn_level': 20,
    },
    '深淵の怒り': {
        'mp_cost': 30,
        'type': 'attack',
        'power': 4.0,
        'element': 'dark',
        'effect': None,
        'effect_chance': 0,
        'target': 'single',
        'color': (150, 50, 255),
        'description': '最大威力の奥義！',
        'learn_level': 28,
    },
}

# ========== アイテムデータ ==========
ITEMS = {
    '深海のしずく': {
        'type': 'heal_hp',
        'value': 50,
        'description': 'HPを50回復する',
        'buy_price': 30,
        'sell_price': 15,
    },
    '深海のしずく＋': {
        'type': 'heal_hp',
        'value': 150,
        'description': 'HPを150回復する',
        'buy_price': 80,
        'sell_price': 40,
    },
    'MPの泡': {
        'type': 'heal_mp',
        'value': 20,
        'description': 'MPを20回復する',
        'buy_price': 50,
        'sell_price': 25,
    },
    '蘇生の珊瑚': {
        'type': 'revive',
        'value': 0.25,
        'description': '戦闘不能から復活（HP25%）',
        'buy_price': 150,
        'sell_price': 75,
    },
    '煙幕の墨': {
        'type': 'escape',
        'value': 0,
        'description': '確実に逃げる（ボス無効）',
        'buy_price': 60,
        'sell_price': 30,
    },
    '毒消し': {
        'type': 'cure_poison',
        'value': 0,
        'description': '毒を治す',
        'buy_price': 20,
        'sell_price': 10,
    },
}

# ========== 武器データ ==========
WEAPONS = {
    '小さなランタン': {'atk': 5,  'buy_price': 0,    'sell_price': 50},
    '光の杖':         {'atk': 12, 'buy_price': 300,  'sell_price': 150},
    '珊瑚の槍':       {'atk': 20, 'buy_price': 600,  'sell_price': 300},
    '深海の刃':       {'atk': 30, 'buy_price': 1200, 'sell_price': 600},
}

# ========== 防具データ ==========
ARMORS = {
    '磯の欠片':   {'def': 3,  'buy_price': 0,   'sell_price': 30},
    '深海の鱗':   {'def': 8,  'buy_price': 200, 'sell_price': 100},
    '光の甲殻':   {'def': 15, 'buy_price': 500, 'sell_price': 250},
    '珊瑚の鎧':   {'def': 25, 'buy_price': 1000,'sell_price': 500},
}

# ========== アクセサリデータ ==========
ACCESSORIES = {
    '貝がらペンダント': {'spd': 3, 'buy_price': 150, 'sell_price': 75},
    '深海の涙':         {'lck': 5, 'buy_price': 200, 'sell_price': 100},
    '知恵の珊瑚':       {'mp': 10, 'buy_price': 250, 'sell_price': 125},
}

# ========== 敵データ ==========
ENEMIES = {
    'プチウニ': {
        'name': 'プチウニ',
        'max_hp': 25, 'max_mp': 0,
        'atk': 9, 'def': 3, 'spd': 5,
        'exp': 6, 'gold': 10,
        'skills': [],
        'drops': [('深海のしずく', 0.4)],
        'sprite': 'assets/test_reversed.png',
        'boss': False,
        'description': '深海に住む小さなウニ。\nとげ攻撃が痛い！',
    },
    'デビルフィッシュ': {
        'name': 'デビルフィッシュ',
        'max_hp': 50, 'max_mp': 12,
        'atk': 15, 'def': 6, 'spd': 9,
        'exp': 18, 'gold': 25,
        'skills': ['毒噴射'],
        'drops': [('MPの泡', 0.3), ('深海のしずく', 0.2)],
        'sprite': 'assets/test_reversed.png',
        'boss': False,
        'description': '毒を噴射する深海魚。\n油断すると毒にやられる！',
    },
    'シャドウクラゲ': {
        'name': 'シャドウクラゲ',
        'max_hp': 65, 'max_mp': 20,
        'atk': 20, 'def': 8, 'spd': 11,
        'exp': 30, 'gold': 40,
        'skills': ['麻痺の触手'],
        'drops': [('深海のしずく＋', 0.25), ('MPの泡', 0.15)],
        'sprite': 'assets/test_reversed.png',
        'boss': False,
        'description': '暗闇に潜むクラゲ。\n触手で麻痺させてくる！',
    },
    'コールドエール': {
        'name': 'コールドエール',
        'max_hp': 85, 'max_mp': 15,
        'atk': 26, 'def': 12, 'spd': 7,
        'exp': 45, 'gold': 55,
        'skills': ['氷の息'],
        'drops': [('深海のしずく＋', 0.3)],
        'sprite': 'assets/test_reversed.png',
        'boss': False,
        'description': '深淵の冷気を纏う魚。\n氷の息で凍えさせる！',
    },
    'ホットクラブ': {
        'name': 'ホットクラブ',
        'max_hp': 320, 'max_mp': 45,
        'atk': 24, 'def': 14, 'spd': 7,
        'exp': 120, 'gold': 180,
        'skills': ['熱波', 'クロー攻撃', '防御固め'],
        'drops': [('光の杖', 1.0), ('深海のしずく＋', 1.0)],
        'sprite': 'assets/test_reversed.png',
        'boss': True,
        'description': '煙突岩に住む巨大なカニ。\n第一ダンジョンのボス！',
    },
    'シャドウアンコウ': {
        'name': 'シャドウアンコウ',
        'max_hp': 520, 'max_mp': 60,
        'atk': 35, 'def': 20, 'spd': 12,
        'exp': 250, 'gold': 350,
        'skills': ['暗闇の灯火', '深海ショック', '連続噛みつき'],
        'drops': [('深海の鱗', 1.0), ('深海のしずく＋', 2)],
        'sprite': 'assets/test_reversed.png',
        'boss': True,
        'description': '幽霊船に棲む恐ろしいアンコウ。\n暗闇で視界を奪う！',
    },
    'ヴォイドクラーケン': {
        'name': 'ヴォイドクラーケン',
        'max_hp': 1500, 'max_mp': 150,
        'atk': 55, 'def': 30, 'spd': 14,
        'exp': 9999, 'gold': 9999,
        'skills': ['虚無の波動', '深淵の引力', '全力触手', '呪いの墨'],
        'drops': [],
        'sprite': 'assets/test_reversed.png',
        'boss': True,
        'description': '深海王国を闇に染める\n最強の魔物ラスボス！',
    },
}

# ========== 敵スキルデータ ==========
ENEMY_SKILLS = {
    '毒噴射': {
        'type': 'attack_status',
        'power': 1.1,
        'effect': 'poison',
        'effect_chance': 0.45,
        'message': 'は毒を噴射した！',
    },
    '麻痺の触手': {
        'type': 'attack_status',
        'power': 0.9,
        'effect': 'paralyze',
        'effect_chance': 0.35,
        'message': 'は触手で攻撃した！',
    },
    '氷の息': {
        'type': 'attack',
        'power': 1.6,
        'effect': None,
        'effect_chance': 0,
        'message': 'は氷の息を吐いた！',
    },
    '熱波': {
        'type': 'attack',
        'power': 1.9,
        'effect': None,
        'effect_chance': 0,
        'message': 'は熱波を放った！',
    },
    'クロー攻撃': {
        'type': 'attack',
        'power': 1.4,
        'effect': None,
        'effect_chance': 0,
        'message': 'は鋭いクローで攻撃した！',
    },
    '防御固め': {
        'type': 'buff_def',
        'power': 1.0,
        'effect': 'def_up',
        'effect_chance': 1.0,
        'message': 'は身を固めた！',
    },
    '暗闇の灯火': {
        'type': 'attack_status',
        'power': 1.5,
        'effect': 'blind',
        'effect_chance': 0.5,
        'message': 'は暗闇の灯火を放った！',
    },
    '深海ショック': {
        'type': 'attack',
        'power': 2.2,
        'effect': None,
        'effect_chance': 0,
        'message': 'は深海ショックを放った！',
    },
    '連続噛みつき': {
        'type': 'multi_attack',
        'power': 0.8,
        'hits': 2,
        'effect': None,
        'effect_chance': 0,
        'message': 'は連続噛みつきをした！',
    },
    '虚無の波動': {
        'type': 'attack',
        'power': 2.5,
        'effect': None,
        'effect_chance': 0,
        'message': 'は虚無の波動を放った！',
    },
    '深淵の引力': {
        'type': 'attack_status',
        'power': 1.8,
        'effect': 'slow',
        'effect_chance': 0.6,
        'message': 'は深淵の引力を発動した！',
    },
    '全力触手': {
        'type': 'attack',
        'power': 3.0,
        'effect': None,
        'effect_chance': 0,
        'message': 'は全力で触手を振り回した！',
    },
    '呪いの墨': {
        'type': 'attack_status',
        'power': 1.2,
        'effect': 'poison',
        'effect_chance': 0.7,
        'message': 'は呪いの墨を噴射した！',
    },
}

# ========== レベルアップ経験値テーブル ==========
# level -> exp needed to reach next level
EXP_TABLE = {
    1: 30,
    2: 50,
    3: 75,
    4: 110,
    5: 160,
    6: 220,
    7: 300,
    8: 400,
    9: 520,
    10: 660,
    11: 820,
    12: 1010,
    13: 1230,
    14: 1490,
    15: 1790,
    16: 2140,
    17: 2550,
    18: 3030,
    19: 3590,
    20: 4240,
}
