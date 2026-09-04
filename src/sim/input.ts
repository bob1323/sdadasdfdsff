import { ControlInput } from './physics';

export const keys = new Set<string>();

export const touch = {
  left: false,
  right: false,
  gas: false,
  brake: false,
  handbrake: false,
};

export type ActionKey = 'camera' | 'reset' | 'tc' | 'abs' | 'auto' | 'help' | 'mute' | 'pause' | 'lights' | 'cones';
const actionListeners = new Set<(a: ActionKey) => void>();
export function onAction(fn: (a: ActionKey) => void) {
  actionListeners.add(fn);
  return () => {
    actionListeners.delete(fn);
  };
}
function fire(a: ActionKey) {
  actionListeners.forEach((f) => f(a));
}

const ACTIONS: Record<string, ActionKey> = {
  KeyC: 'camera',
  KeyR: 'reset',
  KeyT: 'tc',
  KeyB: 'abs',
  KeyM: 'auto',
  KeyH: 'help',
  KeyN: 'mute',
  Escape: 'pause',
  KeyP: 'pause',
  KeyL: 'lights',
  KeyK: 'cones',
};

let shiftUpQueued = false;
let shiftDownQueued = false;
let installed = false;

export function installInput() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'ShiftRight') shiftUpQueued = true;
    if (e.code === 'KeyQ' || e.code === 'ControlRight') shiftDownQueued = true;
    const a = ACTIONS[e.code];
    if (a) fire(a);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

const ctrl: ControlInput = { steer: 0, forward: 0, back: 0, handbrake: false, shiftUp: false, shiftDown: false };

export function readInput(): ControlInput {
  const left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left;
  const right = keys.has('KeyD') || keys.has('ArrowRight') || touch.right;
  ctrl.steer = (left ? 1 : 0) - (right ? 1 : 0);
  ctrl.forward = keys.has('KeyW') || keys.has('ArrowUp') || touch.gas ? 1 : 0;
  ctrl.back = keys.has('KeyS') || keys.has('ArrowDown') || touch.brake ? 1 : 0;
  ctrl.handbrake = keys.has('Space') || touch.handbrake;
  ctrl.shiftUp = shiftUpQueued;
  ctrl.shiftDown = shiftDownQueued;
  shiftUpQueued = false;
  shiftDownQueued = false;
  return ctrl;
}
