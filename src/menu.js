/* Main menu controller. Classic script, loaded before game.js. */
((M) => {
  'use strict';
  M.createMainMenu = function ({host, input, session, renderer}) {
    const screen = host.$('startScreen');
    const main = screen.querySelector('.menu-main');
    const setup = screen.querySelector('.menu-setup');
    const expeditionButton = host.$('menuExpeditionButton');
    const practiceButton = host.$('menuPracticeButton');
    const menu = {selectedMode: 'expedition'};

    menu.showMain = function () {
      screen.hidden = false;
      main.hidden = false;
      setup.hidden = true;
      screen.scrollTop = 0;
      document.body.dataset.screen = 'title';
      for (const id of ['siteHeader', 'pageHeading', 'gameHud', 'commandBar', 'gameFooter', 'battleStatus', 'squadBar', 'worldCaption', 'tripleSlashButton']) host.$(id).hidden = true;
      host.canvas.tabIndex = -1;
      host.canvas.setAttribute('aria-hidden', 'true');
      expeditionButton.focus({preventScroll: true});
      renderer.resize();
    };

    menu.showSetup = function (mode) {
      menu.selectedMode = mode;
      const practice = mode === 'practice';
      main.hidden = true;
      setup.hidden = false;
      screen.scrollTop = 0;
      setup.dataset.mode = mode;
      host.$('menuSetupEyebrow').textContent = practice ? 'LATIHAN DUA JALUR' : 'EKSPEDISI DUA PULAU';
      host.$('menuSetupTitle').textContent = practice ? 'Siapkan pertahananmu.' : 'Siapkan perjalananmu.';
      host.$('menuSetupRoute').textContent = practice ? 'Pulau Dua Arah · pintu kiri dan atas' : 'Pulau Embun → Pulau Dua Arah';
      host.$('menuSetupSummary').textContent = practice
        ? 'Lima gelombang dari dua arah. Mulai dengan 80 emas, 40 kayu, 3 bekal, dan satu pemanah. Upgrade dimulai dari nol.'
        : 'Taklukkan lima gelombang di setiap pulau. Emas dan keenam jalur upgrade dibawa ke pulau berikutnya.';
      setup.querySelector('[data-difficulty][aria-pressed="true"]').focus({preventScroll: true});
    };

    menu.showArena = function () {
      screen.hidden = true;
      document.body.dataset.screen = 'arena';
      for (const id of ['siteHeader', 'pageHeading', 'gameHud', 'commandBar', 'gameFooter', 'battleStatus']) host.$(id).hidden = false;
      host.canvas.tabIndex = 0;
      host.canvas.removeAttribute('aria-hidden');
      renderer.resize();
    };

    menu.ready = function () {
      if (session.initialized) host.$('startLabel').textContent = 'Berangkat';
    };

    input.listen(expeditionButton, 'click', () => menu.showSetup('expedition'));
    input.listen(practiceButton, 'click', () => menu.showSetup('practice'));
    input.listen(host.$('menuBackButton'), 'click', () => {
      const returnButton = menu.selectedMode === 'practice' ? practiceButton : expeditionButton;
      menu.showMain();
      returnButton.focus({preventScroll: true});
    });
    input.listen(host.$('menuSettingsButton'), 'click', () => host.$('audioSettingsButton').click());
    input.listen(host.$('menuHelpButton'), 'click', () => host.$('helpButton').click());
    input.listen(host.$('menuGalleryButton'), 'click', () => host.$('galleryButton').click());
    input.listen(screen, 'keydown', event => {
      if (event.key === 'Escape' && !setup.hidden) {
        event.preventDefault();
        event.stopPropagation();
        host.$('menuBackButton').click();
      } else if (!main.hidden && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        const buttons = [...main.querySelectorAll('.menu-actions button')];
        const index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
      }
    });
    return menu;
  };
})(window.PenjagaModules = window.PenjagaModules || {});
