// EMBERKEEPER — input.js
// Mouse + keyboard state for the browser. Kept separate from the pure
// game logic so Node can import the logic modules without a DOM.
export function createInput(canvas) {
  const input = {
    mouseX: 900,
    mouseY: 300,
    mouseDown: false,
    keys: {},
    // Edge-triggered keys (P pause, M mute, E bell, R restart, Esc) are
    // queued here on the keydown EVENT, so a tap shorter than one frame
    // is never lost — polling `keys` per frame can miss a press that
    // starts and ends between two frames.
    pressed: [],
    clicked: null, // {x, y} of the latest click, consumed by main.js
    moved: false,
  };
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    input.moved = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
    const r = canvas.getBoundingClientRect();
    input.clicked = {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  window.addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    if (!e.repeat) input.pressed.push(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  return input;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Take and clear the queued edge-triggered key presses.
export function consumePressed(input) {
  const out = input.pressed;
  input.pressed = [];
  return out;
}

// Focus = hold left mouse button or hold SPACE.
export function focusHeld(input) {
  return input.mouseDown || !!input.keys['Space'];
}
