import Phaser from 'phaser';

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  attackPressed: boolean;
  attackHeld: boolean;
  dashPressed: boolean;
  swapTriggered: boolean;
  swapHoldRatio: number;
  interactPressed: boolean;
  potionPressed: boolean;
  pausePressed: boolean;
}

export interface InputBindings {
  up: number[];
  down: number[];
  left: number[];
  right: number[];
  attack: number[];
  dash: number[];
  swap: number[];
  interact: number[];
  potion: number[];
  pause: number[];
}

const K = Phaser.Input.Keyboard.KeyCodes;

export const DEFAULT_BINDINGS: InputBindings = {
  up: [K.W, K.UP],
  down: [K.S, K.DOWN],
  left: [K.A, K.LEFT],
  right: [K.D, K.RIGHT],
  attack: [K.J, K.SPACE],
  dash: [K.SHIFT, K.K],
  swap: [K.Q],
  interact: [K.E, K.ENTER],
  potion: [K.F],
  pause: [K.ESC, K.P],
};

/** Hold duration before a weapon swap commits. Keeps taps from firing swaps mid-combo. */
export const SWAP_HOLD_MS = 130;
const STICK_DEADZONE = 0.25;

export class InputManager {
  private readonly keys = new Map<keyof InputBindings, Phaser.Input.Keyboard.Key[]>();
  private readonly snapshot: InputSnapshot = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 1,
    attackPressed: false,
    attackHeld: false,
    dashPressed: false,
    swapTriggered: false,
    swapHoldRatio: 0,
    interactPressed: false,
    potionPressed: false,
    pausePressed: false,
  };

  private pointerDownPrev = false;
  private swapPressedAtMs: number | null = null;
  private swapConsumed = false;
  private readonly previousDigital = new Map<string, boolean>();
  private pointerAimActive = false;

  constructor(
    private readonly scene: Phaser.Scene,
    bindings: InputBindings = DEFAULT_BINDINGS,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input unavailable');

    for (const [action, codes] of Object.entries(bindings) as [keyof InputBindings, number[]][]) {
      this.keys.set(
        action,
        codes.map((code) => keyboard.addKey(code, true, false)),
      );
    }

    scene.input.on(Phaser.Input.Events.POINTER_MOVE, () => {
      this.pointerAimActive = true;
    });
  }

  private isDown(action: keyof InputBindings): boolean {
    const keys = this.keys.get(action);
    if (!keys) return false;
    for (const key of keys) if (key.isDown) return true;
    return false;
  }

  private get pad(): Phaser.Input.Gamepad.Gamepad | null {
    return this.scene.input.gamepad?.getPad(0) ?? null;
  }

  private edge(name: string, current: boolean): boolean {
    const previous = this.previousDigital.get(name) ?? false;
    this.previousDigital.set(name, current);
    return current && !previous;
  }

  update(nowMs: number, ownerWorldX: number, ownerWorldY: number): InputSnapshot {
    const pad = this.pad;
    const s = this.snapshot;

    let moveX = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let moveY = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);

    if (pad) {
      const stickX = pad.leftStick.x;
      const stickY = pad.leftStick.y;
      if (Math.abs(stickX) > STICK_DEADZONE) moveX = stickX;
      if (Math.abs(stickY) > STICK_DEADZONE) moveY = stickY;
      if (pad.left) moveX = -1;
      if (pad.right) moveX = 1;
      if (pad.up) moveY = -1;
      if (pad.down) moveY = 1;
    }
    s.moveX = moveX;
    s.moveY = moveY;

    const rightStickX = pad?.rightStick.x ?? 0;
    const rightStickY = pad?.rightStick.y ?? 0;
    if (Math.abs(rightStickX) > STICK_DEADZONE || Math.abs(rightStickY) > STICK_DEADZONE) {
      s.aimX = rightStickX;
      s.aimY = rightStickY;
      this.pointerAimActive = false;
    } else if (this.pointerAimActive) {
      const pointer = this.scene.input.activePointer;
      const dx = pointer.worldX - ownerWorldX;
      const dy = pointer.worldY - ownerWorldY;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        s.aimX = dx / length;
        s.aimY = dy / length;
      }
    } else if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY);
      s.aimX = moveX / length;
      s.aimY = moveY / length;
    }

    const pointerDown = this.scene.input.activePointer.leftButtonDown();
    const attackHeld = this.isDown('attack') || pointerDown || (pad?.A ?? false) || (pad?.R2 ?? 0) > 0.4;
    s.attackPressed = this.edge('attack', attackHeld) || (pointerDown && !this.pointerDownPrev);
    s.attackHeld = attackHeld;
    this.pointerDownPrev = pointerDown;

    s.dashPressed = this.edge('dash', this.isDown('dash') || (pad?.B ?? false) || (pad?.L2 ?? 0) > 0.4);
    s.interactPressed = this.edge('interact', this.isDown('interact') || (pad?.X ?? false));
    s.potionPressed = this.edge('potion', this.isDown('potion') || (pad?.Y ?? false));
    s.pausePressed = this.edge('pause', this.isDown('pause') || (pad?.buttons[9]?.pressed ?? false));

    const swapDown = this.isDown('swap') || (pad?.L1 ?? false) || (pad?.R1 ?? false);
    s.swapTriggered = false;
    if (swapDown) {
      if (this.swapPressedAtMs === null) {
        this.swapPressedAtMs = nowMs;
        this.swapConsumed = false;
      }
      const heldMs = nowMs - this.swapPressedAtMs;
      s.swapHoldRatio = Math.min(1, heldMs / SWAP_HOLD_MS);
      if (!this.swapConsumed && heldMs >= SWAP_HOLD_MS) {
        s.swapTriggered = true;
        this.swapConsumed = true;
      }
    } else {
      this.swapPressedAtMs = null;
      this.swapConsumed = false;
      s.swapHoldRatio = 0;
    }

    return s;
  }

  destroy(): void {
    this.keys.clear();
    this.previousDigital.clear();
  }
}
