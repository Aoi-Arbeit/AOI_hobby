import pygame
import sys

# --- 設定 ---
SCREEN_WIDTH = 600
SCREEN_HEIGHT = 400
PADDLE_WIDTH = 100
PADDLE_HEIGHT = 15
BALL_SIZE = 10
BLOCK_WIDTH = 70
BLOCK_HEIGHT = 20
BLOCK_ROWS = 5
BLOCK_COLS = 8

# 色の定義
WHITE  = (255, 255, 255)
BLUE   = (0, 0, 255)
RED    = (255, 0, 0)
GREEN  = (0, 255, 0)
BLACK  = (0, 0, 0)
GRAY   = (100, 100, 100)
YELLOW = (255, 220, 0)

# --- 初期化 ---
pygame.init()
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("ブロック崩し")
clock = pygame.time.Clock()
font_large = pygame.font.SysFont(None, 64)
font_small = pygame.font.SysFont(None, 36)


# --- ゲーム状態リセット ---
def reset_game():
    paddle = pygame.Rect(SCREEN_WIDTH // 2 - PADDLE_WIDTH // 2, SCREEN_HEIGHT - 30, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2, BALL_SIZE, BALL_SIZE)
    ball_speed = [4, -4]
    blocks = []
    for row in range(BLOCK_ROWS):
        for col in range(BLOCK_COLS):
            block_x = col * (BLOCK_WIDTH + 5) + 5
            block_y = row * (BLOCK_HEIGHT + 5) + 40
            blocks.append(pygame.Rect(block_x, block_y, BLOCK_WIDTH, BLOCK_HEIGHT))
    return paddle, ball, ball_speed, blocks


# --- ボタン描画 ---
def draw_button(text, rect, color, hover_color, mouse_pos):
    col = hover_color if rect.collidepoint(mouse_pos) else color
    pygame.draw.rect(screen, col, rect, border_radius=8)
    pygame.draw.rect(screen, WHITE, rect, 2, border_radius=8)
    label = font_small.render(text, True, WHITE)
    screen.blit(label, label.get_rect(center=rect.center))


# --- ゲーム状態 ---
STATE_START    = "start"
STATE_PLAYING  = "playing"
STATE_GAMEOVER = "gameover"
STATE_CLEAR    = "clear"

state = STATE_START
paddle, ball, ball_speed, blocks = reset_game()

btn_start  = pygame.Rect(SCREEN_WIDTH // 2 - 90, SCREEN_HEIGHT // 2 + 20, 180, 50)
btn_retry  = pygame.Rect(SCREEN_WIDTH // 2 - 90, SCREEN_HEIGHT // 2 + 20, 180, 50)

# --- メインループ ---
while True:
    screen.fill(BLACK)
    mouse_pos = pygame.mouse.get_pos()

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if state == STATE_START and btn_start.collidepoint(mouse_pos):
                state = STATE_PLAYING

            elif state in (STATE_GAMEOVER, STATE_CLEAR) and btn_retry.collidepoint(mouse_pos):
                paddle, ball, ball_speed, blocks = reset_game()
                state = STATE_PLAYING

    # ========== スタート画面 ==========
    if state == STATE_START:
        title = font_large.render("ブロック崩し", True, YELLOW)
        screen.blit(title, title.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 40)))
        draw_button("スタート", btn_start, BLUE, GREEN, mouse_pos)

    # ========== プレイ中 ==========
    elif state == STATE_PLAYING:
        # パドルの移動
        paddle.centerx = mouse_pos[0]
        paddle.clamp_ip(screen.get_rect())

        # ボールの移動
        ball.x += ball_speed[0]
        ball.y += ball_speed[1]

        # 壁との衝突
        if ball.left <= 0 or ball.right >= SCREEN_WIDTH:
            ball_speed[0] *= -1
        if ball.top <= 0:
            ball_speed[1] *= -1

        # パドルとの衝突
        if ball.colliderect(paddle):
            ball_speed[1] *= -1
            ball.bottom = paddle.top

        # ブロックとの衝突
        hit_index = ball.collidelist(blocks)
        if hit_index != -1:
            blocks.pop(hit_index)
            ball_speed[1] *= -1

        # ゲームオーバー判定
        if ball.bottom >= SCREEN_HEIGHT:
            state = STATE_GAMEOVER

        # クリア判定
        if not blocks:
            state = STATE_CLEAR

        # 描画
        pygame.draw.rect(screen, BLUE, paddle)
        pygame.draw.ellipse(screen, WHITE, ball)
        for block in blocks:
            pygame.draw.rect(screen, RED, block)

    # ========== ゲームオーバー画面 ==========
    elif state == STATE_GAMEOVER:
        msg = font_large.render("GAME OVER", True, RED)
        screen.blit(msg, msg.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 40)))
        draw_button("リトライ", btn_retry, GRAY, GREEN, mouse_pos)

    # ========== クリア画面 ==========
    elif state == STATE_CLEAR:
        msg = font_large.render("CLEAR!", True, YELLOW)
        screen.blit(msg, msg.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 40)))
        draw_button("リトライ", btn_retry, GRAY, GREEN, mouse_pos)

    pygame.display.flip()
    clock.tick(60)
