import pygame
import sys

#初期化
pygame.init()

#画面サイズ
screen_width = 800
screen_height = 600
screen = pygame.display.set_mode((screen_width, screen_height))

pygame.display.set_caption("RPG_Game_Test")

#モニタの解像度
info = pygame.display.Info()
print("モニタ解像度:", info.current_w, info.current_h)
print("ウィンドウサイズ:", screen.get_width(), screen.get_height())

#FPS設定
clock = pygame.time.Clock()
fps = 60

#フォントの設定
font = pygame.font.Font("Noto_Sans_JP/static/NotoSansJP-Light.ttf", 48)

#表示テキスト
message = "キーを押してください"

#キャラクター描写
player_image = pygame.image.load("assets/test.png").convert_alpha()
player_image = pygame.transform.scale(player_image, (150, 150))
player_rect = player_image.get_rect()
player_rect.topleft = (100, 250)
print(player_image.get_at((0, 0)))

enemy_image = pygame.image.load("assets/test_reversed.png").convert_alpha()
enemy_image = pygame.transform.scale(enemy_image, (150, 150))
enemy_rect = enemy_image.get_rect()
enemy_rect.topright = (700, 100)

#コマンド一覧
commands = ["戦う", "魔法", "アイテム", "逃げる"]
selected_command = 0

STATE_COMMAND = 0
STATE_ACTION = 1
STATE_MESSAGE = 2
battle_state = STATE_COMMAND

#メインループ
while True:
    #背景の描画
    screen.fill((255, 255, 255))
    #先頭フィールドの描画
    pygame.draw.rect(screen, (0, 200, 255), (50, 80, 700, 350))

    #イベント処理
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()
        
        if event.type == pygame.KEYDOWN:
            if battle_state == STATE_COMMAND:
                if event.key == pygame.K_UP:
                    selected_command = (selected_command - 1) % len(commands)
                    message = f"選択中のコマンド: {commands[selected_command]}"
                elif event.key == pygame.K_DOWN:
                    selected_command = (selected_command + 1) % len(commands)
                    message = f"選択中のコマンド: {commands[selected_command]}"
                elif event.key == pygame.K_RETURN: 
                    message = "コマンド「{}」が選択されました".format(commands[selected_command])
                    battle_state = STATE_ACTION

            elif battle_state == STATE_ACTION:
                if event.key == pygame.K_RETURN:
                    battle_state = STATE_COMMAND
                    message = "ターン終了"

    #コマンド描写
    x = screen.get_width() // 2
    y = screen.get_height() // 2 + 100
    for i, command in enumerate(commands):
        if i % 2 == 0:
            y += 50
            x -= 300
        else:
            x += 300

        if i == selected_command:
            text = font.render("▶" + command, True, (0, 0, 0))
        else:
            text = font.render("　" + command, True, (0, 0, 0))

        screen.blit(text, (x, y))

    #キャラクター描写
    screen.blit(player_image, player_rect)
    screen.blit(enemy_image, enemy_rect)

    #文字描写
    text = font.render(message, True, (0, 0, 0))
    screen.blit(text, (0, 0))

    pygame.display.flip()
    clock.tick(fps)