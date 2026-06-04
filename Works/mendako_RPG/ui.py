"""
めんだこRPG ～深海の冒険～
UI ユーティリティモジュール
"""
import pygame
import math
from data import (
    FONT_PATH, FONT_BOLD,
    COL_WIN_BG, COL_WIN_BORDER, COL_WIN_BORDER2,
    COL_TEXT, COL_TEXT_DIM, COL_SELECT,
    COL_HP_HIGH, COL_HP_MID, COL_HP_LOW, COL_MP,
)

_font_cache: dict = {}


def get_font(size: int, bold: bool = False) -> pygame.font.Font:
    """フォントをキャッシュして返す"""
    path = FONT_BOLD if bold else FONT_PATH
    key = (path, size)
    if key not in _font_cache:
        try:
            _font_cache[key] = pygame.font.Font(path, size)
        except Exception:
            _font_cache[key] = pygame.font.SysFont('msgothic', size)
    return _font_cache[key]


# ------------------------------------------------------------------ #
#  ウィンドウ描画                                                      #
# ------------------------------------------------------------------ #

def draw_window(surface: pygame.Surface, rect: tuple,
                title: str | None = None, alpha: int = 235) -> None:
    """ドラクエ風ウィンドウを描画する"""
    x, y, w, h = rect

    # シャドウ
    shadow = pygame.Surface((w + 4, h + 4), pygame.SRCALPHA)
    shadow.fill((0, 0, 0, 100))
    surface.blit(shadow, (x + 2, y + 2))

    # 背景
    bg = pygame.Surface((w, h), pygame.SRCALPHA)
    bg.fill((*COL_WIN_BG, alpha))
    surface.blit(bg, (x, y))

    # 外枠（明るい）
    pygame.draw.rect(surface, COL_WIN_BORDER2, (x, y, w, h), 2)
    # 内枠（暗め）
    pygame.draw.rect(surface, COL_WIN_BORDER,  (x + 3, y + 3, w - 6, h - 6), 1)

    # タイトルバー
    if title:
        th = 26
        tbar = pygame.Surface((w - 4, th), pygame.SRCALPHA)
        tbar.fill((25, 55, 130, 210))
        surface.blit(tbar, (x + 2, y + 2))
        draw_text(surface, title, x + 10, y + 5, get_font(17, bold=True), COL_SELECT)


# ------------------------------------------------------------------ #
#  テキスト描画                                                        #
# ------------------------------------------------------------------ #

def draw_text(surface: pygame.Surface, text: str,
              x: int, y: int,
              font: pygame.font.Font,
              color: tuple | None = None,
              shadow: bool = True) -> int:
    """テキストを描画し、描画幅を返す"""
    if color is None:
        color = COL_TEXT
    if shadow:
        s = font.render(text, True, (0, 0, 15))
        surface.blit(s, (x + 1, y + 1))
    ts = font.render(text, True, color)
    surface.blit(ts, (x, y))
    return ts.get_width()


# ------------------------------------------------------------------ #
#  HP / MP バー                                                        #
# ------------------------------------------------------------------ #

def draw_hp_bar(surface: pygame.Surface, hp: int, max_hp: int,
                x: int, y: int, width: int = 150, height: int = 14) -> None:
    """HP バーを描画する"""
    ratio = hp / max_hp if max_hp > 0 else 0

    # 背景
    pygame.draw.rect(surface, (15, 15, 35), (x, y, width, height))
    pygame.draw.rect(surface, (35, 35, 70), (x + 1, y + 1, width - 2, height - 2))

    # バー本体
    if ratio > 0:
        fw = max(1, int((width - 4) * ratio))
        col = COL_HP_HIGH if ratio > 0.5 else (COL_HP_MID if ratio > 0.25 else COL_HP_LOW)
        pygame.draw.rect(surface, col, (x + 2, y + 2, fw, height - 4))
        # ハイライト（上半分）
        hi = tuple(min(255, c + 50) for c in col)
        pygame.draw.rect(surface, hi, (x + 2, y + 2, fw, (height - 4) // 2))

    # 枠
    pygame.draw.rect(surface, COL_WIN_BORDER, (x, y, width, height), 1)


def draw_mp_bar(surface: pygame.Surface, mp: int, max_mp: int,
                x: int, y: int, width: int = 150, height: int = 14) -> None:
    """MP バーを描画する"""
    ratio = mp / max_mp if max_mp > 0 else 0

    pygame.draw.rect(surface, (8, 8, 35), (x, y, width, height))
    pygame.draw.rect(surface, (18, 18, 60), (x + 1, y + 1, width - 2, height - 2))

    if ratio > 0:
        fw = max(1, int((width - 4) * ratio))
        pygame.draw.rect(surface, COL_MP, (x + 2, y + 2, fw, height - 4))
        hi = tuple(min(255, c + 40) for c in COL_MP)
        pygame.draw.rect(surface, hi, (x + 2, y + 2, fw, (height - 4) // 2))

    pygame.draw.rect(surface, COL_WIN_BORDER, (x, y, width, height), 1)


# ------------------------------------------------------------------ #
#  アニメーションクラス                                                #
# ------------------------------------------------------------------ #

class FloatingText:
    """ダメージ・回復などの浮かぶテキスト"""

    def __init__(self, text: str, x: float, y: float,
                 color: tuple, size: int = 26, duration: int = 85):
        self.text = text
        self.x = float(x)
        self.y = float(y)
        self.color = color
        self.size = size
        self.duration = duration
        self.timer = 0
        self.done = False

    def update(self):
        self.timer += 1
        self.y -= 1.1
        if self.timer >= self.duration:
            self.done = True

    def draw(self, surface: pygame.Surface):
        if self.done:
            return
        alpha = max(0, int(255 * (1.0 - self.timer / self.duration)))
        font = get_font(self.size, bold=True)
        ts = font.render(self.text, True, self.color)
        ts.set_alpha(alpha)
        surface.blit(ts, (int(self.x - ts.get_width() / 2), int(self.y)))


class ScreenFlash:
    """画面フラッシュエフェクト"""

    def __init__(self, color: tuple, duration: int = 25, max_alpha: int = 140):
        self.color = color
        self.duration = duration
        self.max_alpha = max_alpha
        self.timer = 0
        self.done = False

    def update(self):
        self.timer += 1
        if self.timer >= self.duration:
            self.done = True

    def draw(self, surface: pygame.Surface):
        if self.done:
            return
        alpha = max(0, int(self.max_alpha * (1.0 - self.timer / self.duration)))
        fs = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        fs.fill((*self.color[:3], alpha))
        surface.blit(fs, (0, 0))


class ShakeEffect:
    """スプライトシェイクエフェクト"""

    def __init__(self, duration: int = 18, intensity: int = 8):
        self.duration = duration
        self.intensity = intensity
        self.timer = 0
        self.done = False
        self.offset_x = 0
        self.offset_y = 0

    def update(self):
        self.timer += 1
        if self.timer >= self.duration:
            self.done = True
            self.offset_x = 0
            self.offset_y = 0
        else:
            amp = self.intensity * (1 - self.timer / self.duration)
            self.offset_x = int(math.sin(self.timer * 1.8) * amp)
            self.offset_y = 0


class BubbleParticles:
    """背景用バブルパーティクル"""

    def __init__(self, width: int, height: int, count: int = 20):
        self.width = width
        self.height = height
        self.particles = [self._make_particle() for _ in range(count)]

    def _make_particle(self):
        import random
        return {
            'x': random.uniform(0, self.width),
            'y': random.uniform(0, self.height),
            'r': random.uniform(2, 5),
            'spd': random.uniform(0.3, 1.0),
            'alpha': random.randint(40, 120),
        }

    def update(self):
        import random
        for p in self.particles:
            p['y'] -= p['spd']
            p['x'] += math.sin(p['y'] * 0.05) * 0.3
            if p['y'] < -10:
                p['x'] = random.uniform(0, self.width)
                p['y'] = self.height + 5

    def draw(self, surface: pygame.Surface):
        bubble_surf = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        for p in self.particles:
            r = int(p['r'])
            col = (80, 160, 230, p['alpha'])
            pygame.draw.circle(bubble_surf, col, (int(p['x']), int(p['y'])), r)
            # ハイライト
            hi_col = (180, 220, 255, p['alpha'])
            pygame.draw.circle(bubble_surf, hi_col, (int(p['x']) - r // 3, int(p['y']) - r // 3), max(1, r // 2))
        surface.blit(bubble_surf, (0, 0))
