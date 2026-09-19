import Phaser from "phaser";
import { Entity } from "./Entity";
import { DEPTH, TUNING } from "../core/GameConfig";
import { EventBus } from "../core/EventBus";
import { TextureKeys } from "../core/TextureFactory";
import type { CombatSystem } from "../combat/CombatSystem";
import type { WeaponLoadout } from "../combat/WeaponLoadout";
import type { Inventory } from "../items/Inventory";
import { applyPotion } from "../items/Potion";
import type { PotionDefinition } from "../core/types";
import type { InputSnapshot } from "../input/InputManager";

const ATTACK_MOVE_PENALTY = 0.45;

export class Player extends Entity {
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly aim = new Phaser.Math.Vector2(0, 1);
  private readonly origin = new Phaser.Math.Vector2();
  private inputLocked = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly loadout: WeaponLoadout,
    private readonly inventory: Inventory,
    private readonly combat: CombatSystem,
    private readonly potions: ReadonlyMap<string, PotionDefinition>,
  ) {
    super({
      scene,
      x,
      y,
      texture: TextureKeys.player,
      faction: "player",
      maxHealth: TUNING.player.maxHealth,
      bodyRadius: 5,
      movement: {
        moveSpeed: TUNING.player.moveSpeed,
        acceleration: TUNING.player.acceleration,
        drag: TUNING.player.drag,
        dashSpeed: TUNING.player.dashSpeed,
        dashDurationMs: TUNING.player.dashDurationMs,
        dashCooldownMs: TUNING.player.dashCooldownMs,
        knockbackResistance: TUNING.player.knockbackResistance,
      },
    });

    this.shadow = scene.add
      .image(x, y + 6, TextureKeys.shadow)
      .setDepth(DEPTH.entityShadow);
    this.arcadeBody.setCollideWorldBounds(true);
    EventBus.emit("player:spawned", {
      current: this.health.current,
      max: this.health.max,
    });
    this.loadout.emitState(false);
  }

  get weaponLoadout(): WeaponLoadout {
    return this.loadout;
  }

  get aimVector(): Phaser.Math.Vector2 {
    return this.aim;
  }

  setInputLocked(locked: boolean): void {
    this.inputLocked = locked;
    if (locked) this.movement.stop();
  }

  handleInput(input: InputSnapshot, nowMs: number): void {
    if (this.dead || this.inputLocked) return;

    if (input.aimX !== 0 || input.aimY !== 0)
      this.aim.set(input.aimX, input.aimY);

    const attacking = this.loadout.active.isInActiveFrames(nowMs);
    const speedMultiplier =
      this.status.speedMultiplier * (attacking ? ATTACK_MOVE_PENALTY : 1);
    this.movement.move(input.moveX, input.moveY, speedMultiplier, nowMs);

    if (
      input.dashPressed &&
      this.movement.dash(input.moveX, input.moveY, nowMs)
    ) {
      this.health.grantInvulnerability(nowMs, TUNING.player.dashIFramesMs);
      this.setAlpha(0.6);
      this.scene.time.delayedCall(TUNING.player.dashDurationMs, () =>
        this.setAlpha(1),
      );
      EventBus.emit("player:dash", {
        cooldownMs: TUNING.player.dashCooldownMs,
      });
    }

    if (input.swapTriggered) this.trySwapWeapon(nowMs);
    if (input.attackPressed || input.attackHeld) this.tryAttack(nowMs);
    if (input.potionPressed) this.useSelectedPotion(nowMs);
  }

  tryAttack(nowMs: number): boolean {
    const weapon = this.loadout.active;
    if (!weapon.canAttack(nowMs)) return false;

    this.origin.set(this.x, this.y);
    const context = this.combat.createContext(this, nowMs);
    const fired = weapon.attack(context, this.origin, this.aim);
    if (fired) {
      EventBus.emit("weapon:cooldown", {
        weaponId: weapon.id,
        remainingMs: weapon.attackIntervalMs,
        totalMs: weapon.attackIntervalMs,
      });
    }
    return fired;
  }

  trySwapWeapon(nowMs: number): boolean {
    return this.loadout.swap(nowMs).swapped;
  }

  useSelectedPotion(nowMs: number): boolean {
    const potionId = this.inventory.selectedPotionId;
    if (!potionId) return false;
    return this.usePotion(potionId, nowMs);
  }

  usePotion(potionId: string, nowMs: number): boolean {
    const definition = this.potions.get(potionId);
    if (!definition || this.inventory.count(potionId) <= 0) return false;

    const result = applyPotion(definition, this, nowMs);
    if (!result.consumed) {
      EventBus.emit("ui:toast", { message: result.message, tone: "warn" });
      return false;
    }

    this.inventory.consume(potionId);
    this.combat.spawnBurst(this.x, this.y, definition.tint, 6);
    EventBus.emit("ui:toast", { message: result.message, tone: "info" });
    EventBus.emit("player:shield-changed", { amount: this.health.shield });
    return true;
  }

  /** Full reset: new dungeon run or death respawn. Heals, clears statuses, resets weapon cooldowns. */
  spawnFresh(x: number, y: number): void {
    this.dead = false;
    this.setActive(true).setVisible(true).setAlpha(1);
    this.arcadeBody.enable = true;
    this.setPosition(x, y);
    this.arcadeBody.reset(x, y);
    this.movement.reset();
    this.status.clear();
    this.health.resetToFull();
    this.loadout.reset();
  }

  /** Reposition only. Used for room-to-room transitions, where health/status/cooldowns must persist. */
  teleport(x: number, y: number): void {
    this.setPosition(x, y);
    this.arcadeBody.reset(x, y);
    this.movement.stop();
  }

  protected override onTick(_nowMs: number, _deltaMs: number): void {
    this.shadow.setPosition(this.x, this.y + 6);
  }

  protected override onHealthChanged(current: number, max: number): void {
    EventBus.emit("player:health-changed", { current, max });
    EventBus.emit("player:shield-changed", { amount: this.health.shield });
  }

  protected override onDamaged(amount: number, _critical: boolean): void {
    EventBus.emit("combat:player-hit", { amount });
    this.scene.cameras.main.shake(120, 0.004);
  }

  protected override onDeath(): void {
    this.shadow.setVisible(false);
    this.setVisible(false);
    EventBus.emit("player:died", {
      roomId: this.scene.registry.get("currentRoomId") ?? "unknown",
    });
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
