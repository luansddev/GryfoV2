/**
 * Constantes e funções utilitárias para alinhamento dinâmico de layout,
 * garantindo que elementos flutuantes nunca colidam com a navbar inferior
 * em nenhum dispositivo (telas curtas, entalhes, barras de navegação do sistema etc.).
 */

export const BOTTOM_MENU_CONTAINER_HEIGHT = 68; // Altura do container do BottomMenu: 48 (ícone/cápsula) + 20 (paddingVertical)
export const BOTTOM_MENU_GAP = 16; // Espaçamento entre o topo da navbar e a base dos controles flutuantes

/**
 * Posição 'bottom' da navbar inferior (BottomMenu) respeitando a área segura inferior (insets.bottom).
 */
export const getBottomMenuBottom = (insetsBottom: number): number => {
  return Math.max(insetsBottom + 20, 30);
};

/**
 * Posição da borda superior da navbar inferior em relação à parte inferior da tela.
 */
export const getBottomMenuTop = (insetsBottom: number): number => {
  return getBottomMenuBottom(insetsBottom) + BOTTOM_MENU_CONTAINER_HEIGHT;
};

/**
 * Retorna a posição 'bottom' ideal para as barras de funções flutuantes das abas
 * (Dados, Relatos e Vigias), garantindo que sempre fiquem acima da navbar inferior.
 */
export const getFloatingControlsBottom = (insetsBottom: number, gap = BOTTOM_MENU_GAP): number => {
  return getBottomMenuTop(insetsBottom) + gap;
};
