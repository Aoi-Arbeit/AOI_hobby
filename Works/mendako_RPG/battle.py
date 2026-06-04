"""
めんだこRPG ～深海の冒険～
バトルシステム（メインエンジン）

【バトル画面レイアウト】
+---------------------------------------------+  y=0
|   敵名＋HPバー               敵スプライト    |  y=0~340
|                                              |
|   プレイヤースプライト（左）                  |
+---------------------------------------------+  y=340
|  [プレイヤーステータス]  [コマンド/スキル/   |
|   名前 Lv  HP  MP        アイテムウィンドウ] |  y=340~460
+---------------------------------------------+  y=460
|  [メッセージウィンドウ]                      |  y=460~595
+---------------------------------------------+  y=600
"""

import pygame
import random
import math

from data import (
    SKILLS, ITEMS, ENEMY_SKILLS,
    COL_TEXT, COL_TEXT_DIM, COL_SELECT, COL_DAMAGE, COL_HEAL,
    COL_CRITICAL, COL_MISS, COL_MP, COL_STATUS_BAD, COL_GOLD,
    COL_HP_HIGH, COL_HP_MID, COL_HP_LOW,
)
from ui import (
    get_font, draw_window, draw_text,
    draw_hp_bar, draw_mp_bar,
    FloatingText, ScreenFlash, ShakeEffect, BubbleParticles,
)

# ---- バトル内部ステート ----
ST_INTRO         = 'intro'          # 戦闘開始演出
ST_COMMAND       = 'command'        # コマンド選択
ST_SKILL_SELECT  = 'skill_select'   # スキル選択
ST_ITEM_SELECT   = 'item_select'    # アイテム選択
ST_SHOWING_MSG   = 'showing_msg'    # メッセージ表示待ち
ST_VICTORY       = 'victory'        # 勝利
ST_DEFEAT        = 'defeat'         # 敗北
ST_FLED          = 'fled'           # 逃走


class Battle:
    """バトルクラス。毎フレーム update() → draw() を呼び出す。"""

    # ---- 初期化 ----

    def __init__(self, screen: pygame.Surface, player, enemy):
        self.screen = screen
        self.player = player
        self.enemy = enemy
        self.W = screen.get_width()
        self.H = screen.get_height()

        # 結果：None / 'victory' / 'defeat' / 'fled'
        self.result = None

        # バトル状態
        self.state = ST_INTRO
        self.selected = 0          # 現在の選択インデックス
        self.after_msg_state = ST_COMMAND  # メッセージ消化後の遷移先

        # メッセージキュー
        self._msg_queue: list[str] = []
        self.current_msg: str = ''

        # エフェクト
        self.floating_texts: list[FloatingText] = []
        self.flashes: list[ScreenFlash] = []

        # スプライト位置
        self.PLAYER_CX = 180
        self.PLAYER_CY = 285
        self.ENEMY_CX  = 560
        self.ENEMY_CY  = 170

        # アニメーション
        self.player_shake = ShakeEffect(duration=0)
        self.enemy_shake  = ShakeEffect(duration=0)
        self.player_atk_offset = 0   # 攻撃時のX移動量

        # 背景バブル
        self.bubbles = BubbleParticles(self.W, 340, count=18)

        # 背景（事前生成）
        self.bg_surf = pygame.Surface((self.W, self.H))
        self._build_background()

        # スプライト読み込み
        self._load_sprites()

        # 勝利後情報
        self.levelup_infos: list[dict] = []
        self.drop_messages: list[str] = []

        # イントロタイマー
        self.intro_timer = 55
        self.intro_alpha = 0

        # ターン数
        self.turn = 1

        # メッセージ送り用タイマー（キー長押し対策）
        self._confirm_cooldown = 0

    # ---------------------------------------------------------------- #
    #  公開インターフェース                                              #
    # ---------------------------------------------------------------- #

    def is_done(self) -> bool:
        return self.result is not None

    def get_result(self) -> str | None:
        return self.result

    def update(self, events: list):
        """毎フレーム呼ぶ。入力処理＋状態更新"""
        # タイマー
        if self._confirm_cooldown > 0:
            self._confirm_cooldown -= 1

        # エフェクト更新
        self.bubbles.update()
        self.floating_texts = [f for f in self.floating_texts if not f.done]
        for ft in self.floating_texts:
            ft.update()
        self.flashes = [f for f in self.flashes if not f.done]
        for fl in self.flashes:
            fl.update()

        # アニメーション
        if not self.enemy_shake.done:
            self.enemy_shake.update()
        if not self.player_shake.done:
            self.player_shake.update()
        if self.player_atk_offset > 0:
            self.player_atk_offset = max(0, self.player_atk_offset - 18)

        # イントロ
        if self.state == ST_INTRO:
            self.intro_timer -= 1
            self.intro_alpha = min(255, int(255 * (1 - self.intro_timer / 55)))
            if self.intro_timer <= 0:
                self._push_msg(f'{self.enemy.name}が あらわれた！')
                self._goto_after_msg(ST_COMMAND)
                self.state = ST_SHOWING_MSG
            return

        # キー入力
        for ev in events:
            if ev.type == pygame.KEYDOWN:
                self._on_key(ev.key)

    # ---------------------------------------------------------------- #
    #  描画                                                             #
    # ---------------------------------------------------------------- #

    def draw(self):
        """毎フレーム呼ぶ。全描画"""
        # 背景
        self.screen.blit(self.bg_surf, (0, 0))

        # バブル（戦闘エリア上半分）
        self.bubbles.draw(self.screen)

        # イントロフェードイン
        if self.state == ST_INTRO:
            fade = pygame.Surface((self.W, self.H))
            fade.fill((0, 0, 0))
            fade.set_alpha(255 - self.intro_alpha)
            self.screen.blit(fade, (0, 0))
            self._draw_intro_text()
            return

        # 敵
        self._draw_enemy()

        # プレイヤー
        self._draw_player()

        # エフェクト
        for fl in self.flashes:
            fl.draw(self.screen)
        for ft in self.floating_texts:
            ft.draw(self.screen)

        # UI 下エリア仕切り
        pygame.draw.rect(self.screen, (5, 10, 28), (0, 340, self.W, self.H - 340))
        pygame.draw.line(self.screen, (50, 100, 200), (0, 340), (self.W, 340), 2)

        # プレイヤーステータス（左）
        self._draw_player_status()

        # コマンド or サブウィンドウ（右）
        if self.state == ST_COMMAND:
            self._draw_command_window()
        elif self.state == ST_SKILL_SELECT:
            self._draw_skill_window()
        elif self.state == ST_ITEM_SELECT:
            self._draw_item_window()

        # メッセージウィンドウ（下）
        self._draw_message_window()

    # ---------------------------------------------------------------- #
    #  キー入力処理                                                     #
    # ---------------------------------------------------------------- #

    def _on_key(self, key):
        UP   = key in (pygame.K_UP,   pygame.K_w)
        DOWN = key in (pygame.K_DOWN, pygame.K_s)
        OK   = key in (pygame.K_RETURN, pygame.K_z, pygame.K_SPACE)
        BACK = key in (pygame.K_ESCAPE, pygame.K_x, pygame.K_BACKSPACE)

        if self.state == ST_SHOWING_MSG:
            if OK and self._confirm_cooldown == 0:
                self._confirm_cooldown = 8
                if self._msg_queue:
                    self.current_msg = self._msg_queue.pop(0)
                else:
                    # メッセージ消化 → 次の状態へ
                    self._transition_after_msg()
            return

        if self.state == ST_COMMAND:
            if UP:
                self.selected = (self.selected - 1) % 4
            elif DOWN:
                self.selected = (self.selected + 1) % 4
            elif OK:
                self._confirm_cooldown = 8
                self._execute_command()
            return

        if self.state == ST_SKILL_SELECT:
            skills = self.player.skills
            if UP:
                self.selected = (self.selected - 1) % max(1, len(skills))
            elif DOWN:
                self.selected = (self.selected + 1) % max(1, len(skills))
            elif BACK:
                self.state = ST_COMMAND
                self.selected = 1
            elif OK:
                self._confirm_cooldown = 8
                if skills:
                    self._use_skill(skills[self.selected])
            return

        if self.state == ST_ITEM_SELECT:
            item_keys = list(self.player.items.keys())
            if UP:
                self.selected = (self.selected - 1) % max(1, len(item_keys))
            elif DOWN:
                self.selected = (self.selected + 1) % max(1, len(item_keys))
            elif BACK:
                self.state = ST_COMMAND
                self.selected = 2
            elif OK:
                self._confirm_cooldown = 8
                if item_keys:
                    self._use_item(item_keys[self.selected])
            return

    # ---------------------------------------------------------------- #
    #  コマンド実行                                                     #
    # ---------------------------------------------------------------- #

    COMMANDS = ['たたかう', 'スキル', 'どうぐ', 'にげる']

    def _execute_command(self):
        cmd = self.COMMANDS[self.selected]
        if cmd == 'たたかう':
            self._player_normal_attack()
        elif cmd == 'スキル':
            if not self.player.skills:
                self._push_msg('使えるスキルがない！')
                self._goto_after_msg(ST_COMMAND)
                self.state = ST_SHOWING_MSG
            else:
                self.state = ST_SKILL_SELECT
                self.selected = 0
        elif cmd == 'どうぐ':
            if not self.player.items:
                self._push_msg('アイテムを持っていない！')
                self._goto_after_msg(ST_COMMAND)
                self.state = ST_SHOWING_MSG
            else:
                self.state = ST_ITEM_SELECT
                self.selected = 0
        elif cmd == 'にげる':
            self._try_flee()

    # ---------------------------------------------------------------- #
    #  プレイヤー行動                                                   #
    # ---------------------------------------------------------------- #

    def _player_normal_attack(self):
        """通常攻撃"""
        self.player_atk_offset = 110  # 攻撃アニメーション

        # 暗闇ミスチェック
        if self.player.is_blinded() and random.random() < 0.45:
            self._push_msg(f'{self.player.name}の攻撃はあたらなかった！')
            self._add_float('MISS', self.ENEMY_CX, self.ENEMY_CY - 40, COL_MISS)
            self._after_player_action()
            return

        crit = random.random() < max(0.02, self.player.total_lck * 0.012)
        dmg = self._calc_damage(self.player.total_atk, self.enemy.total_def, crit=crit)
        self.enemy.take_damage(dmg)
        self.enemy_shake = ShakeEffect(duration=16, intensity=9)

        if crit:
            self._push_msg('会心の一撃！！')
            self._push_msg(f'{self.enemy.name}に {dmg} のダメージ！')
            self._add_float(f'★{dmg}', self.ENEMY_CX, self.ENEMY_CY - 40, COL_CRITICAL, size=32)
            self.flashes.append(ScreenFlash((255, 255, 150), duration=18, max_alpha=120))
        else:
            self._push_msg(f'{self.enemy.name}に {dmg} のダメージ！')
            self._add_float(str(dmg), self.ENEMY_CX, self.ENEMY_CY - 40, COL_DAMAGE)
            self.flashes.append(ScreenFlash((200, 50, 50), duration=10, max_alpha=60))

        self._after_player_action()

    def _use_skill(self, skill_id: str):
        """スキル使用"""
        skill = SKILLS.get(skill_id)
        if not skill:
            return

        if self.player.mp < skill['mp_cost']:
            self._push_msg('MPが足りない！')
            self._goto_after_msg(ST_SKILL_SELECT)
            self.state = ST_SHOWING_MSG
            return

        self.player.mp -= skill['mp_cost']
        self._push_msg(f'{self.player.name}は {skill_id} を使った！')
        self.flashes.append(ScreenFlash(skill.get('color', (100, 100, 255)), duration=22, max_alpha=130))

        stype = skill['type']

        if stype == 'attack':
            dmg = self._calc_damage(self.player.total_atk, self.enemy.total_def,
                                    power=skill['power'])
            self.enemy.take_damage(dmg)
            self.enemy_shake = ShakeEffect(duration=20, intensity=11)
            self._push_msg(f'{self.enemy.name}に {dmg} のダメージ！')
            self._add_float(str(dmg), self.ENEMY_CX, self.ENEMY_CY - 50, COL_DAMAGE, size=30)

            # 追加効果
            effect = skill.get('effect')
            if effect and effect != 'debuff_clear' and random.random() < skill.get('effect_chance', 0):
                self.enemy.apply_status(effect)
                effect_jp = {'blind': '暗闇', 'poison': '毒', 'paralyze': '麻痺', 'slow': '鈍足'}
                self._push_msg(f'{self.enemy.name}は{effect_jp.get(effect, effect)}になった！')
            elif effect == 'debuff_clear':
                self.player.clear_debuffs()
                self._push_msg(f'{self.player.name}の状態異常が回復した！')

        elif stype == 'heal':
            amount = int(skill['power'])
            old_hp = self.player.hp
            self.player.heal(amount)
            healed = self.player.hp - old_hp
            self._push_msg(f'{self.player.name}のHPが {healed} 回復した！')
            self._add_float(f'+{healed}', self.PLAYER_CX, self.PLAYER_CY - 50, COL_HEAL, size=30)
            self.flashes.append(ScreenFlash((80, 220, 120), duration=20, max_alpha=90))

        self._after_player_action()

    def _use_item(self, item_id: str):
        """アイテム使用"""
        item = ITEMS.get(item_id)
        if not item:
            return

        success = True

        if item['type'] == 'heal_hp':
            old_hp = self.player.hp
            self.player.use_item(item_id)
            self.player.heal(item['value'])
            healed = self.player.hp - old_hp
            self._push_msg(f'{item_id} を使った！')
            self._push_msg(f'HPが {healed} 回復した！')
            self._add_float(f'+{healed}', self.PLAYER_CX, self.PLAYER_CY - 50, COL_HEAL)
            self.flashes.append(ScreenFlash((80, 220, 120), duration=18, max_alpha=80))

        elif item['type'] == 'heal_mp':
            self.player.use_item(item_id)
            self.player.restore_mp(item['value'])
            self._push_msg(f'{item_id} を使った！')
            self._push_msg(f'MPが {item["value"]} 回復した！')
            self._add_float(f'+{item["value"]}MP', self.PLAYER_CX, self.PLAYER_CY - 50, COL_MP)

        elif item['type'] == 'escape':
            if self.enemy.boss:
                self._push_msg('ボス戦では使えない！')
                self._goto_after_msg(ST_COMMAND)
                self.state = ST_SHOWING_MSG
                return
            self.player.use_item(item_id)
            self._push_msg('煙幕を張って逃げ出した！')
            self._goto_after_msg(ST_FLED)
            self.state = ST_SHOWING_MSG
            return

        elif item['type'] == 'cure_poison':
            if 'poison' in self.player.status:
                self.player.use_item(item_id)
                del self.player.status['poison']
                self._push_msg(f'{item_id} を使った！')
                self._push_msg(f'{self.player.name}の毒が回復した！')
            else:
                self._push_msg('毒にかかっていない...')
                self._goto_after_msg(ST_COMMAND)
                self.state = ST_SHOWING_MSG
                return

        elif item['type'] == 'revive':
            # バトル中は自分のHPが残っていれば使えない（蘇生は仲間用なので空振り）
            self._push_msg('使う相手がいない...')
            self._goto_after_msg(ST_COMMAND)
            self.state = ST_SHOWING_MSG
            return

        if success:
            self._after_player_action()

    def _try_flee(self):
        """逃走試み"""
        if self.enemy.boss:
            self._push_msg(f'ボスからは逃げられない！')
            self._goto_after_msg(ST_COMMAND)
            self.state = ST_SHOWING_MSG
            return

        flee_chance = 0.5 + (self.player.total_spd - self.enemy.spd) * 0.04
        flee_chance = max(0.15, min(0.9, flee_chance))

        if random.random() < flee_chance:
            self._push_msg('うまく逃げ出した！')
            self._goto_after_msg(ST_FLED)
        else:
            self._push_msg('逃げられなかった！')
            self._goto_after_msg('enemy_turn')

        self.state = ST_SHOWING_MSG

    # ---------------------------------------------------------------- #
    #  プレイヤー行動後の共通処理                                       #
    # ---------------------------------------------------------------- #

    def _after_player_action(self):
        """プレイヤーが行動した後の処理（勝敗判定 → 次の状態決定）"""
        if not self.enemy.is_alive():
            # 勝利！
            self._handle_victory_messages()
            self._goto_after_msg(ST_VICTORY)
            self.state = ST_SHOWING_MSG
        else:
            # 敵ステータスtick
            for msg in self.enemy.tick_status():
                self._push_msg(msg)
            if not self.enemy.is_alive():
                self._handle_victory_messages()
                self._goto_after_msg(ST_VICTORY)
            else:
                self._goto_after_msg('enemy_turn')
            self.state = ST_SHOWING_MSG

    # ---------------------------------------------------------------- #
    #  敵行動                                                           #
    # ---------------------------------------------------------------- #

    def _do_enemy_turn(self):
        """敵ターンを実行"""
        if not self.enemy.is_alive():
            self._transition_to_command()
            return

        action_type, action_data = self.enemy.choose_action()

        if action_type == 'attack':
            self._enemy_normal_attack()
        elif action_type == 'skill':
            self._enemy_use_skill(action_data)

    def _enemy_normal_attack(self):
        """敵の通常攻撃"""
        dmg = self._calc_damage(self.enemy.atk, self.player.total_def)
        self.player.take_damage(dmg)
        self.player_shake = ShakeEffect(duration=14, intensity=7)
        self._push_msg(f'{self.enemy.name}の攻撃！')
        self._push_msg(f'{self.player.name}は {dmg} のダメージを受けた！')
        self._add_float(str(dmg), self.PLAYER_CX, self.PLAYER_CY - 50, COL_DAMAGE)
        self.flashes.append(ScreenFlash((200, 50, 50), duration=12, max_alpha=70))
        self._after_enemy_action()

    def _enemy_use_skill(self, skill_id: str):
        """敵のスキル使用"""
        skill = ENEMY_SKILLS.get(skill_id, {})
        msg_suffix = skill.get('message', 'は行動した！')
        self._push_msg(f'{self.enemy.name}{msg_suffix}')

        stype = skill.get('type', 'attack')

        if stype in ('attack', 'attack_status'):
            power = skill.get('power', 1.0)
            hits = skill.get('hits', 1)
            total_dmg = 0
            for _ in range(hits):
                dmg = self._calc_damage(self.enemy.atk, self.player.total_def, power=power)
                self.player.take_damage(dmg)
                total_dmg += dmg

            self.player_shake = ShakeEffect(duration=18, intensity=9)
            self._push_msg(f'{self.player.name}は {total_dmg} のダメージを受けた！')
            self._add_float(str(total_dmg), self.PLAYER_CX, self.PLAYER_CY - 50, COL_DAMAGE, size=28)
            self.flashes.append(ScreenFlash((200, 50, 50), duration=14, max_alpha=80))

            # 状態異常
            effect = skill.get('effect')
            if effect and effect not in ('def_up',) and random.random() < skill.get('effect_chance', 0):
                if effect not in self.player.status:
                    self.player.apply_status(effect)
                    effect_jp = {'poison': '毒', 'blind': '暗闇', 'paralyze': '麻痺', 'slow': '鈍足'}
                    self._push_msg(f'{self.player.name}は{effect_jp.get(effect, effect)}状態になった！')

        elif stype == 'buff_def':
            self.enemy._def_bonus += 8
            self._push_msg(f'{self.enemy.name}の防御力が上がった！')
            self.flashes.append(ScreenFlash((100, 100, 255), duration=16, max_alpha=80))

        self._after_enemy_action()

    def _after_enemy_action(self):
        """敵行動後：プレイヤーステータスtick → 勝敗判定"""
        # プレイヤー状態異常 tick
        status_msgs, skip = self.player.tick_status()
        for msg in status_msgs:
            self._push_msg(msg)

        if not self.player.is_alive():
            self._push_msg(f'{self.player.name}は たおれてしまった…')
            self._goto_after_msg(ST_DEFEAT)
        else:
            self._goto_after_msg(ST_COMMAND)

        self.state = ST_SHOWING_MSG

    # ---------------------------------------------------------------- #
    #  勝利処理                                                         #
    # ---------------------------------------------------------------- #

    def _handle_victory_messages(self):
        exp   = self.enemy.exp
        gold  = self.enemy.gold
        drops = self.enemy.roll_drops()

        self._push_msg(f'{self.enemy.name}を 倒した！')
        self._push_msg(f'経験値 {exp} を獲得！')
        self._push_msg(f'ゴールド {gold} Ｇ を手に入れた！')
        self._add_float(f'+{gold}G', self.ENEMY_CX, self.ENEMY_CY, COL_GOLD, size=28)

        self.player.gold += gold

        for item_id, count in drops:
            self.player.add_item(item_id, count)
            s = f'×{count}' if count > 1 else ''
            self._push_msg(f'{item_id}{s} を手に入れた！')

        # 経験値
        levelups = self.player.gain_exp(exp)
        for lu in levelups:
            self.levelup_infos.append(lu)
            self._push_msg(f'レベルが {lu["level"]} に上がった！')
            self._push_msg(f'HP +{lu["hp_gain"]}  ATK +{lu["atk_gain"]}')
            if lu['new_skill']:
                self._push_msg(f'スキル「{lu["new_skill"]}」を覚えた！')
            self.flashes.append(ScreenFlash((255, 240, 100), duration=50, max_alpha=110))

    # ---------------------------------------------------------------- #
    #  メッセージ状態遷移                                               #
    # ---------------------------------------------------------------- #

    def _transition_after_msg(self):
        """メッセージが全部終わった後に呼ばれる"""
        nxt = self.after_msg_state

        if nxt == ST_COMMAND:
            self._transition_to_command()
        elif nxt == 'enemy_turn':
            self._do_enemy_turn()
        elif nxt == ST_VICTORY:
            self.result = 'victory'
            self.state = ST_VICTORY
        elif nxt == ST_DEFEAT:
            self.result = 'defeat'
            self.state = ST_DEFEAT
        elif nxt == ST_FLED:
            self.result = 'fled'
            self.state = ST_FLED
        elif nxt == ST_SKILL_SELECT:
            self.state = ST_SKILL_SELECT
        else:
            self._transition_to_command()

    def _transition_to_command(self):
        self.state = ST_COMMAND
        self.selected = 0
        self.turn += 1

    def _goto_after_msg(self, next_state):
        self.after_msg_state = next_state

    def _push_msg(self, msg: str):
        if self._msg_queue:
            self._msg_queue.append(msg)
        else:
            if self.current_msg:
                self._msg_queue.append(msg)
            else:
                self.current_msg = msg

    # ---------------------------------------------------------------- #
    #  ダメージ計算                                                     #
    # ---------------------------------------------------------------- #

    def _calc_damage(self, atk: int, def_: int,
                     power: float = 1.0, crit: bool = False) -> int:
        base = max(1, atk - def_ // 2)
        dmg = int(base * power * random.uniform(0.88, 1.15))
        if crit:
            dmg = int(dmg * 1.6)
        return max(1, dmg)

    # ---------------------------------------------------------------- #
    #  ユーティリティ                                                   #
    # ---------------------------------------------------------------- #

    def _add_float(self, text, x, y, color, size=26, duration=85):
        self.floating_texts.append(FloatingText(text, x, y, color, size, duration))

    # ---------------------------------------------------------------- #
    #  背景・スプライト生成                                             #
    # ---------------------------------------------------------------- #

    def _build_background(self):
        """深海バトル背景を事前生成"""
        W, H = self.W, self.H
        surf = self.bg_surf

        # グラデーション（暗い深海）
        for y in range(H):
            t = y / H
            r = int(2  + t * 8)
            g = int(5  + t * 22)
            b = int(18 + t * 45)
            pygame.draw.line(surf, (r, g, b), (0, y), (W, y))

        # 海底エリア
        pygame.draw.rect(surf, (8, 25, 58), (0, 310, W, 35))
        pygame.draw.rect(surf, (5, 18, 40), (0, 340, W, H - 340))

        # 岩・珊瑚（装飾）
        deco = [
            (60,  290, 50, 30, (12, 35, 70)),
            (700, 275, 55, 40, (12, 35, 70)),
            (220, 305, 35, 25, (15, 42, 80)),
            (580, 295, 40, 30, (15, 42, 80)),
            (400, 315, 25, 20, (10, 30, 60)),
        ]
        for rx, ry, rw, rh, col in deco:
            pygame.draw.ellipse(surf, col, (rx, ry, rw, rh))

        # 静的バブル
        for bx, by, br in [(90, 180, 3), (160, 90, 2), (660, 140, 3),
                           (730, 70, 2), (360, 40, 2), (510, 110, 3),
                           (280, 200, 2), (440, 160, 3)]:
            pygame.draw.circle(surf, (30, 80, 160), (bx, by), br)

    def _load_sprites(self):
        """スプライト読み込み"""
        # プレイヤースプライト
        try:
            img = pygame.image.load('assets/test.png').convert_alpha()
            self.player_sprite = pygame.transform.scale(img, (150, 150))
        except Exception:
            self.player_sprite = self._make_fallback_sprite((120, 180, 255), 70)

        # 敵スプライト
        try:
            img = pygame.image.load(self.enemy.sprite_path).convert_alpha()
            size = (260, 260) if self.enemy.boss else (190, 190)
            self.enemy_sprite  = pygame.transform.scale(img, size)
            self.enemy_sprite_orig = self.enemy_sprite.copy()
        except Exception:
            size = (260, 260) if self.enemy.boss else (190, 190)
            self.enemy_sprite = self._make_fallback_sprite((200, 60, 60), size[0] // 2 - 5)
            self.enemy_sprite_orig = self.enemy_sprite.copy()

    def _make_fallback_sprite(self, color, radius):
        size = (radius * 2 + 10, radius * 2 + 10)
        surf = pygame.Surface(size, pygame.SRCALPHA)
        pygame.draw.circle(surf, color, (size[0] // 2, size[1] // 2), radius)
        return surf

    # ---------------------------------------------------------------- #
    #  描画ヘルパー                                                     #
    # ---------------------------------------------------------------- #

    def _draw_intro_text(self):
        font = get_font(34, bold=True)
        text = f'{self.enemy.name} が あらわれた！'
        ts = font.render(text, True, COL_TEXT)
        ts.set_alpha(self.intro_alpha)
        x = self.W // 2 - ts.get_width() // 2
        y = self.H // 2 - 20
        self.screen.blit(ts, (x, y))

    def _draw_enemy(self):
        """敵スプライト＋ステータス"""
        # シェイクオフセット
        sx = self.enemy_shake.offset_x if not self.enemy_shake.done else 0
        ex = self.ENEMY_CX - self.enemy_sprite.get_width() // 2 + sx
        ey = self.ENEMY_CY - self.enemy_sprite.get_height() // 2

        # 被ダメ赤フラッシュ
        sprite = self.enemy_sprite
        if not self.enemy_shake.done and self.enemy_shake.timer < 8:
            tinted = sprite.copy()
            red = pygame.Surface(sprite.get_size(), pygame.SRCALPHA)
            red.fill((255, 80, 80, 120))
            tinted.blit(red, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)
            sprite = tinted

        self.screen.blit(sprite, (ex, ey))

        # 敵名＋HPバー
        nw, nh = 270, 65
        nx = self.ENEMY_CX - nw // 2
        ny = ey - nh - 8
        draw_window(self.screen, (nx, ny, nw, nh))

        fn  = get_font(19, bold=True)
        fnx = get_font(15)
        name_w = fn.render(self.enemy.name, True, COL_SELECT).get_width()
        draw_text(self.screen, self.enemy.name, nx + (nw - name_w) // 2, ny + 6, fn, COL_SELECT)
        draw_text(self.screen, 'HP', nx + 8, ny + 34, fnx, COL_TEXT_DIM)
        draw_hp_bar(self.screen, self.enemy.hp, self.enemy.max_hp,
                    nx + 32, ny + 34, width=160, height=14)
        hp_text = f'{self.enemy.hp}/{self.enemy.max_hp}'
        draw_text(self.screen, hp_text, nx + 198, ny + 32, fnx, COL_TEXT)

        # 状態異常バッジ
        if self.enemy.status:
            effect_jp = {'poison': '毒', 'blind': '暗闇', 'paralyze': '麻痺', 'slow': '鈍足', 'def_up': '防御↑'}
            badges = [effect_jp.get(e, e) for e in self.enemy.status]
            draw_text(self.screen, ' '.join(badges), nx + 8, ny + 52, get_font(12), COL_STATUS_BAD)

    def _draw_player(self):
        """プレイヤースプライト"""
        sx = self.player_shake.offset_x if not self.player_shake.done else 0
        atk_off = self.player_atk_offset

        px = self.PLAYER_CX - self.player_sprite.get_width() // 2 + sx + atk_off
        py = self.PLAYER_CY - self.player_sprite.get_height() // 2

        sprite = self.player_sprite
        # 被ダメ青フラッシュ
        if not self.player_shake.done and self.player_shake.timer < 8:
            tinted = sprite.copy()
            blue = pygame.Surface(sprite.get_size(), pygame.SRCALPHA)
            blue.fill((100, 100, 255, 100))
            tinted.blit(blue, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)
            sprite = tinted

        self.screen.blit(sprite, (px, py))

    def _draw_player_status(self):
        """プレイヤーステータス（左下）"""
        x, y, w, h = 12, 344, 310, 112
        draw_window(self.screen, (x, y, w, h))

        fn   = get_font(20, bold=True)
        fn_m = get_font(17)
        fn_s = get_font(14)

        # 名前・レベル
        draw_text(self.screen, self.player.name, x + 10, y + 8, fn, COL_SELECT)
        draw_text(self.screen, f'Lv.{self.player.level}', x + 210, y + 10, fn_m, COL_TEXT)

        # HP
        draw_text(self.screen, 'HP', x + 10, y + 40, fn_m, COL_TEXT_DIM)
        draw_hp_bar(self.screen, self.player.hp, self.player.max_hp,
                    x + 40, y + 42, width=170, height=14)
        hp_text = f'{self.player.hp}/{self.player.max_hp}'
        draw_text(self.screen, hp_text, x + 216, y + 40, fn_s, COL_TEXT)

        # MP
        draw_text(self.screen, 'MP', x + 10, y + 64, fn_m, COL_TEXT_DIM)
        draw_mp_bar(self.screen, self.player.mp, self.player.total_max_mp,
                    x + 40, y + 66, width=170, height=14)
        mp_text = f'{self.player.mp}/{self.player.total_max_mp}'
        draw_text(self.screen, mp_text, x + 216, y + 64, fn_s, COL_TEXT)

        # 状態異常
        if self.player.status:
            effect_jp = {'poison': '毒', 'blind': '暗闇', 'paralyze': '麻痺', 'slow': '鈍足'}
            badges = [effect_jp.get(e, e) for e in self.player.status]
            draw_text(self.screen, ' '.join(badges), x + 10, y + 90, fn_s, COL_STATUS_BAD)

    def _draw_command_window(self):
        """コマンドウィンドウ（右）"""
        x, y, w, h = 330, 344, 458, 112
        draw_window(self.screen, (x, y, w, h), title=f'{self.player.name}のこうどう')

        fn = get_font(22)
        # 2×2 グリッド
        positions = [
            (x + 20,  y + 40),
            (x + 250, y + 40),
            (x + 20,  y + 78),
            (x + 250, y + 78),
        ]
        for i, (cx, cy) in enumerate(positions):
            cmd = self.COMMANDS[i]
            if i == self.selected:
                pygame.draw.rect(self.screen, (35, 65, 130), (cx - 5, cy - 2, 195, 34))
                draw_text(self.screen, f'▶ {cmd}', cx, cy + 2, fn, COL_SELECT)
            else:
                draw_text(self.screen, f'  {cmd}', cx, cy + 2, fn, COL_TEXT)

    def _draw_skill_window(self):
        """スキル選択ウィンドウ（全幅）"""
        x, y, w, h = 12, 344, 776, 112
        draw_window(self.screen, (x, y, w, h), title='スキル')

        fn   = get_font(20)
        fn_s = get_font(15)
        skills = self.player.skills

        if not skills:
            draw_text(self.screen, '使えるスキルがない', x + 20, y + 50, fn, COL_TEXT_DIM)
            return

        col_w = w // 2 - 10
        for i, skill_id in enumerate(skills[:4]):  # 最大4表示
            col  = i % 2
            row  = i // 2
            sx   = x + 12 + col * (col_w + 8)
            sy   = y + 36 + row * 38

            skill    = SKILLS.get(skill_id, {})
            mp_cost  = skill.get('mp_cost', 0)
            can_use  = self.player.mp >= mp_cost
            desc     = skill.get('description', '')

            if i == self.selected:
                pygame.draw.rect(self.screen, (35, 65, 130), (sx - 4, sy - 2, col_w, 32))
                draw_text(self.screen, f'▶ {skill_id}', sx, sy + 2, fn, COL_SELECT if can_use else COL_TEXT_DIM)
            else:
                draw_text(self.screen, f'  {skill_id}', sx, sy + 2, fn, COL_TEXT if can_use else COL_TEXT_DIM)

            mp_col = COL_MP if can_use else (120, 60, 60)
            draw_text(self.screen, f'MP:{mp_cost}', sx + 160, sy + 5, fn_s, mp_col)
            draw_text(self.screen, desc, sx + 220, sy + 6, fn_s, COL_TEXT_DIM)

        draw_text(self.screen, '[ESC/X] もどる', x + w - 150, y + h - 20, get_font(13), COL_TEXT_DIM)

    def _draw_item_window(self):
        """アイテム選択ウィンドウ（全幅）"""
        x, y, w, h = 12, 344, 776, 112
        draw_window(self.screen, (x, y, w, h), title='どうぐ')

        fn   = get_font(20)
        fn_s = get_font(15)
        items = list(self.player.items.items())

        if not items:
            draw_text(self.screen, 'アイテムを持っていない', x + 20, y + 50, fn, COL_TEXT_DIM)
            return

        col_w = w // 2 - 10
        for i, (item_id, count) in enumerate(items[:4]):
            col = i % 2
            row = i // 2
            ix  = x + 12 + col * (col_w + 8)
            iy  = y + 36 + row * 38

            item = ITEMS.get(item_id, {})
            desc = item.get('description', '')

            if i == self.selected:
                pygame.draw.rect(self.screen, (35, 65, 130), (ix - 4, iy - 2, col_w, 32))
                draw_text(self.screen, f'▶ {item_id}', ix, iy + 2, fn, COL_SELECT)
            else:
                draw_text(self.screen, f'  {item_id}', ix, iy + 2, fn, COL_TEXT)

            draw_text(self.screen, f'×{count}', ix + 180, iy + 5, fn_s, COL_TEXT)
            draw_text(self.screen, desc, ix + 220, iy + 6, fn_s, COL_TEXT_DIM)

        draw_text(self.screen, '[ESC/X] もどる', x + w - 150, y + h - 20, get_font(13), COL_TEXT_DIM)

    def _draw_message_window(self):
        """メッセージウィンドウ（最下部）"""
        x, y, w, h = 12, 462, 776, 128
        draw_window(self.screen, (x, y, w, h))

        fn = get_font(22)

        if self.current_msg:
            # 行折り返し（簡易：全角約17文字/行）
            lines = self._wrap_text(self.current_msg, max_chars=30)
            for li, line in enumerate(lines[:3]):
                draw_text(self.screen, line, x + 14, y + 14 + li * 32, fn, COL_TEXT)

        # メッセージ待ち▼
        if self.state == ST_SHOWING_MSG:
            tick = (pygame.time.get_ticks() // 450) % 2
            if tick == 0:
                draw_text(self.screen, '▼', x + w - 22, y + h - 22, get_font(16), COL_SELECT)

    @staticmethod
    def _wrap_text(text: str, max_chars: int = 28) -> list[str]:
        """テキストを指定文字数で折り返す"""
        lines = []
        while len(text) > max_chars:
            lines.append(text[:max_chars])
            text = text[max_chars:]
        lines.append(text)
        return [l for l in lines if l]
