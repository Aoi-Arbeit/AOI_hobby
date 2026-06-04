"""
めんだこRPG ～深海の冒険～
キャラクタークラス定義
"""
import random
from data import SKILLS, ITEMS, WEAPONS, ARMORS, ACCESSORIES, ENEMIES, EXP_TABLE


class Player:
    """プレイヤー（めんだこ）クラス"""

    def __init__(self, name='メンタ'):
        self.name = name
        self.level = 1
        self.exp = 0
        self.exp_next = EXP_TABLE.get(1, 30)

        # 基本ステータス
        self.max_hp = 35
        self.max_mp = 18
        self.hp = 35
        self.mp = 18
        self.atk = 12
        self.def_ = 6
        self.spd = 9
        self.lck = 5

        # 装備
        self.weapon = '小さなランタン'
        self.armor = '磯の欠片'
        self.accessory = None

        # スキル（習得済み）
        self.skills = ['スミアタック']

        # アイテム {name: count}
        self.items = {'深海のしずく': 3}

        # 所持金
        self.gold = 50

        # 状態異常 {effect: remaining_turns}
        self.status = {}

    # ---- 装備込みステータス ----

    @property
    def total_atk(self):
        bonus = WEAPONS.get(self.weapon, {}).get('atk', 0) if self.weapon else 0
        return self.atk + bonus

    @property
    def total_def(self):
        bonus = ARMORS.get(self.armor, {}).get('def', 0) if self.armor else 0
        return self.def_ + bonus

    @property
    def total_spd(self):
        bonus = 0
        if self.accessory:
            bonus += ACCESSORIES.get(self.accessory, {}).get('spd', 0)
        spd = self.spd + bonus
        if 'slow' in self.status:
            spd = int(spd * 0.6)
        return spd

    @property
    def total_max_mp(self):
        bonus = 0
        if self.accessory:
            bonus += ACCESSORIES.get(self.accessory, {}).get('mp', 0)
        return self.max_mp + bonus

    @property
    def total_lck(self):
        bonus = 0
        if self.accessory:
            bonus += ACCESSORIES.get(self.accessory, {}).get('lck', 0)
        return self.lck + bonus

    # ---- HP/MP 操作 ----

    def heal(self, amount):
        self.hp = min(self.max_hp, self.hp + amount)

    def restore_mp(self, amount):
        self.mp = min(self.total_max_mp, self.mp + amount)

    def take_damage(self, damage):
        self.hp = max(0, self.hp - damage)

    def is_alive(self):
        return self.hp > 0

    # ---- アイテム操作 ----

    def add_item(self, item_id, count=1):
        """アイテム追加（各最大9個）"""
        if item_id in self.items:
            self.items[item_id] = min(9, self.items[item_id] + count)
        else:
            self.items[item_id] = min(9, count)

    def use_item(self, item_id):
        """アイテムを1個消費。成功すればTrue"""
        if item_id not in self.items or self.items[item_id] <= 0:
            return False
        self.items[item_id] -= 1
        if self.items[item_id] == 0:
            del self.items[item_id]
        return True

    # ---- ステータス異常 ----

    def apply_status(self, effect, turns=3):
        self.status[effect] = turns

    def clear_status(self):
        self.status.clear()

    def clear_debuffs(self):
        for key in ['poison', 'blind', 'paralyze', 'slow']:
            if key in self.status:
                del self.status[key]

    def tick_status(self):
        """ターン終了時のステータス処理。メッセージリストと麻痺スキップフラグを返す"""
        messages = []
        skip_turn = False
        to_remove = []

        for effect, turns in list(self.status.items()):
            if effect == 'poison':
                dmg = max(1, self.max_hp // 10)
                self.take_damage(dmg)
                messages.append(f'{self.name}は毒のダメージを受けた！（{dmg}）')
            elif effect == 'paralyze':
                if random.random() < 0.4:
                    messages.append(f'{self.name}は麻痺して動けない！')
                    skip_turn = True

            self.status[effect] = turns - 1
            if self.status[effect] <= 0:
                to_remove.append(effect)

        for e in to_remove:
            if e in self.status:
                del self.status[e]
                effect_jp = {'poison': '毒', 'blind': '暗闇', 'paralyze': '麻痺', 'slow': '鈍足'}
                messages.append(f'{self.name}の{effect_jp.get(e, e)}が回復した！')

        return messages, skip_turn

    # ---- 経験値・レベルアップ ----

    def gain_exp(self, amount):
        """経験値を取得し、レベルアップ情報のリストを返す"""
        self.exp += amount
        results = []
        while self.exp >= self.exp_next and self.level < 30:
            self.exp -= self.exp_next
            info = self._do_level_up()
            results.append(info)
        return results

    def _do_level_up(self):
        self.level += 1

        hp_gain  = random.randint(4, 7)
        mp_gain  = random.randint(1, 3)
        atk_gain = random.randint(1, 3)
        def_gain = random.randint(0, 2)
        spd_gain = random.randint(0, 1)
        lck_gain = random.randint(0, 1)

        self.max_hp  += hp_gain
        self.max_mp  += mp_gain
        self.atk     += atk_gain
        self.def_    += def_gain
        self.spd     += spd_gain
        self.lck     += lck_gain

        # レベルアップで全回復
        self.hp = self.max_hp
        self.mp = self.total_max_mp

        # 次の経験値
        self.exp_next = EXP_TABLE.get(self.level, int(self.exp_next * 1.4))

        # スキル習得チェック
        new_skill = None
        for skill_id, skill_data in SKILLS.items():
            if skill_data.get('learn_level') == self.level and skill_id not in self.skills:
                self.skills.append(skill_id)
                new_skill = skill_id
                break

        return {
            'level':     self.level,
            'new_skill': new_skill,
            'hp_gain':   hp_gain,
            'mp_gain':   mp_gain,
            'atk_gain':  atk_gain,
        }

    def is_blinded(self):
        return 'blind' in self.status


class Enemy:
    """敵キャラクタークラス"""

    def __init__(self, enemy_id):
        data = ENEMIES[enemy_id]
        self.id = enemy_id
        self.name = data['name']
        self.max_hp = data['max_hp']
        self.max_mp = data.get('max_mp', 0)
        self.hp = data['max_hp']
        self.mp = data.get('max_mp', 0)
        self.atk = data['atk']
        self.def_ = data['def']
        self.spd = data['spd']
        self.exp = data['exp']
        self.gold = int(data['gold'] * random.uniform(0.85, 1.15))
        self.skills = list(data.get('skills', []))
        self.drops = data.get('drops', [])
        self.sprite_path = data.get('sprite', 'assets/test_reversed.png')
        self.boss = data.get('boss', False)
        self.description = data.get('description', '')

        self.status = {}
        self._def_bonus = 0  # 防御アップバフ

    @property
    def total_def(self):
        return self.def_ + self._def_bonus

    def is_alive(self):
        return self.hp > 0

    def take_damage(self, damage):
        self.hp = max(0, self.hp - damage)

    def apply_status(self, effect, turns=3):
        self.status[effect] = turns

    def choose_action(self):
        """敵AIが行動を決定。(action_type, data) を返す"""
        hp_ratio = self.hp / self.max_hp

        if self.skills:
            skill_chance = 0.4
            if hp_ratio < 0.3:
                skill_chance = 0.65
            if random.random() < skill_chance:
                skill = random.choice(self.skills)
                return ('skill', skill)

        return ('attack', None)

    def roll_drops(self):
        """ドロップアイテムを抽選して返す [(item_id, count), ...]"""
        drops = []
        for item_id, chance in self.drops:
            if isinstance(chance, int) and chance > 1:
                drops.append((item_id, chance))
            elif isinstance(chance, float) and random.random() < chance:
                drops.append((item_id, 1))
        return drops

    def tick_status(self):
        """ターン終了時の処理"""
        messages = []
        to_remove = []

        for effect, turns in list(self.status.items()):
            if effect == 'poison':
                dmg = max(1, self.max_hp // 12)
                self.take_damage(dmg)
                messages.append(f'{self.name}は毒のダメージを受けた！（{dmg}）')

            self.status[effect] = turns - 1
            if self.status[effect] <= 0:
                to_remove.append(effect)

        for e in to_remove:
            if e in self.status:
                del self.status[e]
                messages.append(f'{self.name}の状態が回復した！')

        return messages
