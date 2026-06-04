"""
めんだこRPG ～深海の冒険～
メインエントリーポイント

【起動方法】
  cd mendako_RPG
  python main.py

【操作方法】
  ↑↓（またはW/S）  : 選択移動
  Enter / Z / Space : 決定
  ESC / X / BS     : キャンセル
"""

import pygame
import sys
import os
import math

# カレントディレクトリをスクリプトの場所に設定
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from data import FONT_PATH, FONT_BOLD, COL_TEXT, COL_TEXT_DIM, COL_SELECT, COL_DAMAGE, COL_WIN_BORDER2
from character import Player, Enemy
from battle import Battle
from ui import get_font, draw_window, draw_text, draw_hp_bar, draw_mp_bar

# ------------------------------------------------------------------ #
#  定数                                                               #
# ------------------------------------------------------------------ #
SCREEN_W = 800
SCREEN_H = 600
FPS      = 60
TITLE    = 'めんだこRPG ～深海の冒険～'

# デモ用 敵選択リスト
DEMO_ENEMIES = [
    ('プチウニ',         'やさしい（初心者向け）'),
    ('デビルフィッシュ', '普通（毒攻撃あり）'),
    ('シャドウクラゲ',   '少し難しい（麻痺あり）'),
    ('コールドエール',   '難しい（強力な攻撃）'),
    ('ホットクラブ',     'ボス戦！（第1ダンジョン）'),
]


# ------------------------------------------------------------------ #
#  タイトル画面                                                       #
# ------------------------------------------------------------------ #
class TitleScreen:
    def __init__(self, screen: pygame.Surface):
        self.screen = screen
        self.W, self.H = screen.get_size()
        self.selected = 0
        self.menus = ['はじめから', 'バトルを選ぶ（デモ）']
        self.timer = 0
        self.bg = self._build_bg()

    def _build_bg(self):
        surf = pygame.Surface((self.W, self.H))
        for y in range(self.H):
            t = y / self.H
            pygame.draw.line(surf, (int(t*5), int(5+t*15), int(20+t*50)), (0, y), (self.W, y))
        return surf

    def update(self, events):
        self.timer += 1
        for ev in events:
            if ev.type == pygame.KEYDOWN:
                if ev.key in (pygame.K_UP, pygame.K_w):
                    self.selected = (self.selected - 1) % len(self.menus)
                elif ev.key in (pygame.K_DOWN, pygame.K_s):
                    self.selected = (self.selected + 1) % len(self.menus)
                elif ev.key in (pygame.K_RETURN, pygame.K_z, pygame.K_SPACE):
                    return 'new_game' if self.selected == 0 else 'enemy_select'
        return None

    def draw(self):
        self.screen.blit(self.bg, (0, 0))

        fn_title = get_font(44, bold=True)
        fn_sub   = get_font(22)
        fn_menu  = get_font(26)

        # タイトル波打ちアニメ
        title_str = 'めんだこRPG'
        total_w = sum(fn_title.size(c)[0] for c in title_str)
        cx = self.W // 2 - total_w // 2
        for ci, ch in enumerate(title_str):
            oy = int(math.sin(self.timer * 0.08 + ci * 0.55) * 7)
            ts = fn_title.render(ch, True, COL_SELECT)
            self.screen.blit(ts, (cx, 135 + oy))
            cx += fn_title.size(ch)[0]

        sub_s = fn_sub.render('～深海の冒険～', True, COL_TEXT_DIM)
        self.screen.blit(sub_s, (self.W // 2 - sub_s.get_width() // 2, 202))

        # めんだこキャラ
        try:
            img = pygame.image.load('assets/test.png').convert_alpha()
            img = pygame.transform.scale(img, (130, 130))
            bob = int(math.sin(self.timer * 0.06) * 8)
            self.screen.blit(img, (self.W // 2 - 65, 248 + bob))
        except Exception:
            bob = int(math.sin(self.timer * 0.06) * 8)
            pygame.draw.circle(self.screen, (120, 180, 255), (self.W // 2, 315 + bob), 55)

        # メニュー
        draw_window(self.screen, (self.W // 2 - 185, 418, 370, 118))
        for i, menu in enumerate(self.menus):
            my = 432 + i * 48
            if i == self.selected:
                pygame.draw.rect(self.screen, (35, 65, 130), (self.W//2 - 170, my - 2, 340, 36))
                draw_text(self.screen, f'▶ {menu}', self.W // 2 - 155, my + 3, fn_menu, COL_SELECT)
            else:
                draw_text(self.screen, f'  {menu}', self.W // 2 - 155, my + 3, fn_menu, COL_TEXT)

        draw_text(self.screen, '↑↓：選択　Enter/Z：決定',
                  self.W // 2 - 115, self.H - 28, get_font(16), COL_TEXT_DIM)


# ------------------------------------------------------------------ #
#  敵選択画面（デモ用）                                               #
# ------------------------------------------------------------------ #
class EnemySelectScreen:
    def __init__(self, screen: pygame.Surface):
        self.screen = screen
        self.W, self.H = screen.get_size()
        self.selected = 0

    def update(self, events):
        for ev in events:
            if ev.type == pygame.KEYDOWN:
                if ev.key in (pygame.K_UP, pygame.K_w):
                    self.selected = (self.selected - 1) % len(DEMO_ENEMIES)
                elif ev.key in (pygame.K_DOWN, pygame.K_s):
                    self.selected = (self.selected + 1) % len(DEMO_ENEMIES)
                elif ev.key in (pygame.K_RETURN, pygame.K_z, pygame.K_SPACE):
                    return DEMO_ENEMIES[self.selected][0]
                elif ev.key in (pygame.K_ESCAPE, pygame.K_x):
                    return '__back__'
        return None

    def draw(self):
        self.screen.fill((5, 5, 20))

        fn_t = get_font(28, bold=True)
        fn   = get_font(22)
        fn_d = get_font(16)

        draw_text(self.screen, '戦う敵を選んでください',
                  self.W // 2 - 190, 35, fn_t, COL_SELECT)

        wx, wy = 90, 90
        ww = 620
        wh = 30 + len(DEMO_ENEMIES) * 58
        draw_window(self.screen, (wx, wy, ww, wh))

        for i, (name, desc) in enumerate(DEMO_ENEMIES):
            ey = wy + 18 + i * 58
            if i == self.selected:
                pygame.draw.rect(self.screen, (35, 65, 130), (wx + 5, ey - 2, ww - 10, 50))
                draw_text(self.screen, f'▶ {name}', wx + 18, ey + 6, fn, COL_SELECT)
                draw_text(self.screen, desc, wx + 235, ey + 10, fn_d, COL_TEXT_DIM)
            else:
                draw_text(self.screen, f'  {name}', wx + 18, ey + 6, fn, COL_TEXT)
                draw_text(self.screen, desc, wx + 235, ey + 10, fn_d, COL_TEXT_DIM)

        draw_text(self.screen, '↑↓：選択　Enter/Z：決定　ESC：もどる',
                  self.W // 2 - 185, self.H - 35, get_font(16), COL_TEXT_DIM)


# ------------------------------------------------------------------ #
#  リザルト画面                                                       #
# ------------------------------------------------------------------ #
class ResultScreen:
    def __init__(self, screen: pygame.Surface, result: str, player: Player):
        self.screen = screen
        self.W, self.H = screen.get_size()
        self.result = result
        self.player = player
        self.timer = 0

    def update(self, events):
        self.timer += 1
        for ev in events:
            if ev.type == pygame.KEYDOWN:
                if ev.key in (pygame.K_RETURN, pygame.K_z, pygame.K_SPACE, pygame.K_ESCAPE):
                    return 'continue'
        return None

    def draw(self):
        self.screen.fill((5, 5, 20))

        fn_big = get_font(42, bold=True)
        fn     = get_font(22)
        fn_s   = get_font(18)

        if self.result == 'victory':
            color = COL_SELECT
            msg   = 'しょうり！'
            sub   = f'{self.player.name} は戦いに勝った！'
        elif self.result == 'defeat':
            color = COL_DAMAGE
            msg   = 'ゲームオーバー'
            sub   = f'{self.player.name} は倒れてしまった…'
        else:
            color = COL_TEXT
            msg   = 'にげた！'
            sub   = '戦いから逃げ出した...'

        alpha = min(255, int(255 * self.timer / 25))

        ts = fn_big.render(msg, True, color)
        ts.set_alpha(alpha)
        self.screen.blit(ts, (self.W // 2 - ts.get_width() // 2, 145))

        ss = fn.render(sub, True, COL_TEXT)
        ss.set_alpha(alpha)
        self.screen.blit(ss, (self.W // 2 - ss.get_width() // 2, 215))

        if self.timer > 18:
            p = self.player
            draw_window(self.screen, (self.W // 2 - 210, 280, 420, 220))
            bx = self.W // 2 - 195
            by = 298
            draw_text(self.screen, f'{p.name}  Lv.{p.level}', bx, by,      fn, COL_SELECT)
            draw_text(self.screen, 'HP', bx, by + 40, fn_s, COL_TEXT_DIM)
            draw_hp_bar(self.screen, p.hp, p.max_hp,   bx + 35, by + 42, width=170, height=14)
            draw_text(self.screen, f'{p.hp}/{p.max_hp}',   bx + 212, by + 40, get_font(15), COL_TEXT)
            draw_text(self.screen, 'MP', bx, by + 68, fn_s, COL_TEXT_DIM)
            draw_mp_bar(self.screen, p.mp, p.max_mp,   bx + 35, by + 70, width=170, height=14)
            draw_text(self.screen, f'{p.mp}/{p.max_mp}',   bx + 212, by + 68, get_font(15), COL_TEXT)
            draw_text(self.screen, f'EXP:  {p.exp} / {p.exp_next}', bx, by + 105, fn_s, COL_TEXT)
            draw_text(self.screen, f'GOLD: {p.gold} G',               bx, by + 132, fn_s, COL_TEXT)
            draw_text(self.screen, f'ターン数: {p.level}',             bx + 230, by + 105, fn_s, COL_TEXT_DIM)

        draw_text(self.screen, 'Enter/Z で続ける',
                  self.W // 2 - 95, self.H - 45, get_font(16), COL_TEXT_DIM)


# ------------------------------------------------------------------ #
#  メインループ                                                        #
# ------------------------------------------------------------------ #
def main():
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    pygame.display.set_caption(TITLE)
    clock = pygame.time.Clock()

    # アイコン
    try:
        icon = pygame.image.load('assets/test.png').convert_alpha()
        pygame.display.set_icon(pygame.transform.scale(icon, (32, 32)))
    except Exception:
        pass

    # シーン管理
    scene         = 'title'
    title_screen  = TitleScreen(screen)
    enemy_select  = None
    battle        = None
    result_screen = None
    player        = Player('メンタ')

    while True:
        events = pygame.event.get()
        for ev in events:
            if ev.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

        # ---- タイトル ----
        if scene == 'title':
            action = title_screen.update(events)
            title_screen.draw()
            if action == 'new_game':
                player = Player('メンタ')
                enemy_select = EnemySelectScreen(screen)
                scene = 'enemy_select'
            elif action == 'enemy_select':
                enemy_select = EnemySelectScreen(screen)
                scene = 'enemy_select'

        # ---- 敵選択 ----
        elif scene == 'enemy_select':
            action = enemy_select.update(events)
            enemy_select.draw()
            if action and action != '__back__':
                enemy  = Enemy(action)
                battle = Battle(screen, player, enemy)
                scene  = 'battle'
            elif action == '__back__':
                scene = 'title'

        # ---- バトル ----
        elif scene == 'battle':
            battle.update(events)
            battle.draw()
            if battle.is_done():
                result_screen = ResultScreen(screen, battle.get_result(), player)
                scene = 'result'

        # ---- リザルト ----
        elif scene == 'result':
            action = result_screen.update(events)
            result_screen.draw()
            if action == 'continue':
                # 負けた場合はHP回復してから続行
                if not player.is_alive():
                    player.hp = player.max_hp
                    player.mp = player.total_max_mp
                enemy_select = EnemySelectScreen(screen)
                scene = 'enemy_select'

        pygame.display.flip()
        clock.tick(FPS)


if __name__ == '__main__':
    main()
