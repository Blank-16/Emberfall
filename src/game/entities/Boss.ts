import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { DEPTH } from "../core/GameConfig";
import { EventBus } from "../core/EventBus";
import { TextureKeys } from "../core/TextureFactory";
import { BossController, type BossActions } from "../ai/BossController";
import type { CombatSystem } from "../combat/CombatSystem";
import type { BossAttackPattern, BossDefinition } from "../core/types";
import type { Rng } from "../core/Rng";

export type SummonHandler = (enemyId: string, x: number, y: number) => void;

export class Boss extends Enemy implements BossActions {
  private readonly controller: BossController;
  private readonly bossDefinition: BossDefinition;
  private readonly chargeVector = new Phaser.Math.Vector2();
  private lastVolleyAtMs = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: BossDefinition,
    combat: CombatSystem,
    rng: Rng,
    private readonly onSummon: SummonHandler,
  ) {
    super(scene, x, y, definition, combat, TextureKeys.boss);
    this.bossDefinition = definition;
    this.controller = new BossController(definition, this, rng);
    this.setScale(definition.isMiniBoss ? 1 : 1.25);

    EventBus.emit("boss:spawned", {
      bossId: definition.id,
      displayName: definition.displayName,
      max: this.health.max,
    });
  }

  approachTarget(nowMs: number): void {
    if (this.distanceToTarget() > this.definition.attackRange * 0.8)
      this.moveToward(1, nowMs);
    else this.halt();
    this.faceTarget();
  }

  showTelegraph(pattern: BossAttackPattern): void {
    this.telegraph ??= this.scene.add
      .image(this.x, this.y, TextureKeys.telegraph)
      .setDepth(DEPTH.hazard)
      .setVisible(false);

    const scale = (pattern.radius * 2) / 64;
    this.telegraph
      .setPosition(this.x, this.y)
      .setScale(pattern.kind === "charge" ? 0.8 : scale)
      .setTint(pattern.kind === "charge" ? 0xffd166 : 0xff5c7a)
      .setAlpha(0.12)
      .setVisible(true);

    this.scene.tweens.add({
      targets: this.telegraph,
      alpha: 0.55,
      duration: pattern.telegraphMs,
    });
  }

  hideTelegraph(): void {
    this.telegraph?.setVisible(false);
  }

  performPattern(pattern: BossAttackPattern, nowMs: number): void {
    switch (pattern.kind) {
      case "radial_burst":
        this.fireRadial(pattern);
        break;
      case "volley":
        this.lastVolleyAtMs = 0;
        this.fireVolley(pattern);
        break;
      case "slam":
        this.slam(pattern);
        break;
      case "charge":
        this.beginCharge(pattern, nowMs);
        break;
      case "summon":
        this.summonAdds(pattern);
        break;
      default:
        break;
    }
  }

  sustainPattern(
    pattern: BossAttackPattern,
    nowMs: number,
    elapsedMs: number,
  ): void {
    if (pattern.kind === "charge") {
      this.movement.moveDirect(
        this.chargeVector.x,
        this.chargeVector.y,
        this.definition.moveSpeed * 3.2,
        nowMs,
        true,
      );
      return;
    }
    if (pattern.kind === "volley" && elapsedMs - this.lastVolleyAtMs > 260) {
      this.lastVolleyAtMs = elapsedMs;
      this.fireVolley(pattern);
    }
  }

  private fireRadial(pattern: BossAttackPattern): void {
    const count = Math.max(4, pattern.projectileCount);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.combat.spawnProjectile({
        x: this.x + Math.cos(angle) * 12,
        y: this.y + Math.sin(angle) * 12,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        speed: this.definition.projectileSpeed ?? 130,
        damage: pattern.damage,
        knockback: 110,
        faction: "enemy",
        abilityEffectId: "none",
        owner: this,
        lifetimeMs: 2600,
        tint: 0xff7a5c,
        scale: 1.2,
        piercing: false,
      });
    }
    this.scene.cameras.main.shake(140, 0.004);
  }

  private fireVolley(pattern: BossAttackPattern): void {
    const dir = new Phaser.Math.Vector2(0, 1);
    const target = this.targetPosition();
    if (target) dir.set(target.x - this.x, target.y - this.y).normalize();

    const count = Math.max(1, pattern.projectileCount);
    const spread = 0.22;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spread;
      const angle = Math.atan2(dir.y, dir.x) + offset;
      this.combat.spawnProjectile({
        x: this.x + Math.cos(angle) * 14,
        y: this.y + Math.sin(angle) * 14,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        speed: this.definition.projectileSpeed ?? 170,
        damage: pattern.damage,
        knockback: 90,
        faction: "enemy",
        abilityEffectId: "none",
        owner: this,
        lifetimeMs: 2400,
        tint: 0xffc15c,
        scale: 1,
        piercing: false,
      });
    }
  }

  private slam(pattern: BossAttackPattern): void {
    this.combat.spawnHitbox({
      x: this.x,
      y: this.y,
      dirX: 1,
      dirY: 0,
      width: pattern.radius * 2,
      height: pattern.radius * 2,
      offset: 0,
      durationMs: pattern.activeMs,
      damage: pattern.damage,
      knockback: 260,
      faction: "enemy",
      abilityEffectId: "none",
      owner: this,
      texture: TextureKeys.shockwave,
      tint: 0xff8a5c,
      followOwner: false,
      maxTargets: 4,
    });
    this.scene.cameras.main.shake(220, 0.008);
  }

  private beginCharge(pattern: BossAttackPattern, nowMs: number): void {
    const target = this.targetPosition();
    if (target)
      this.chargeVector.set(target.x - this.x, target.y - this.y).normalize();

    this.combat.spawnHitbox({
      x: this.x,
      y: this.y,
      dirX: this.chargeVector.x,
      dirY: this.chargeVector.y,
      width: 26,
      height: 26,
      offset: 0,
      durationMs: pattern.activeMs,
      damage: pattern.damage,
      knockback: 280,
      faction: "enemy",
      abilityEffectId: "none",
      owner: this,
      followOwner: true,
      maxTargets: 1,
    });
    this.movement.moveDirect(
      this.chargeVector.x,
      this.chargeVector.y,
      this.definition.moveSpeed * 3.2,
      nowMs,
      true,
    );
  }

  private summonAdds(pattern: BossAttackPattern): void {
    const enemyId = pattern.summonEnemyId;
    if (!enemyId) return;
    const count = Math.max(1, pattern.projectileCount);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.onSummon(
        enemyId,
        this.x + Math.cos(angle) * pattern.radius,
        this.y + Math.sin(angle) * pattern.radius,
      );
    }
  }

  private targetPosition(): { x: number; y: number } | null {
    return this.target ? { x: this.target.x, y: this.target.y } : null;
  }

  protected override onTick(nowMs: number, _deltaMs: number): void {
    this.controller.update(nowMs);
    this.telegraph?.setPosition(this.x, this.y);
  }

  protected override onHealthChanged(current: number, max: number): void {
    EventBus.emit("boss:health-changed", { current, max });
  }

  protected override onDeath(): void {
    this.controller.reset();
    super.onDeath();
    this.scene.cameras.main.shake(420, 0.01);
    EventBus.emit("boss:defeated", { bossId: this.bossDefinition.id });
  }
}
