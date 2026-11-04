/* World-space viewport shared by gameplay and the map preview. */
((M) => {
  'use strict';
  M.Camera2D = class Camera2D {
    constructor(worldWidth, worldHeight, viewHeight = 704) {
      this.worldWidth = worldWidth;
      this.worldHeight = worldHeight;
      this.width = 1280;
      this.height = viewHeight;
      this.x = 0;
      this.y = 0;
    }

    resize(cssWidth, cssHeight) {
      if (!(cssWidth > 0 && cssHeight > 0)) return;
      this.width = this.height * cssWidth / cssHeight;
    }

    follow(target) {
      const axis = (position, span, worldSpan) => span >= worldSpan
        ? (worldSpan - span) / 2
        : Math.max(0, Math.min(worldSpan - span, position - span / 2));
      this.x = axis(target.x, this.width, this.worldWidth);
      this.y = axis(target.y, this.height, this.worldHeight);
    }

    screenToWorld(clientX, clientY, rect) {
      return {
        x: this.x + (clientX - rect.left) * this.width / rect.width,
        y: this.y + (clientY - rect.top) * this.height / rect.height
      };
    }

    worldToScreen(x, y, rect) {
      return {
        x: rect.left + (x - this.x) * rect.width / this.width,
        y: rect.top + (y - this.y) * rect.height / this.height
      };
    }

    intersects(x, y, width, height) {
      return x + width >= this.x && x <= this.x + this.width &&
        y + height >= this.y && y <= this.y + this.height;
    }
  };
})(window.PenjagaModules = window.PenjagaModules || {});
