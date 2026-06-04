import pygame
pygame.init()

fonts = pygame.font.get_fonts()
for f in fonts:
    print(f)