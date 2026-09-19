import Phaser from "phaser";

export interface MovementConfig {
  readonly moveSpeed: number;
  readonly acceleration: number;
  readonly drag: number;
  readonly dashSpeed: number;
  readonly dashDurationMs: number;
  readonly dashCooldownMs: number;
  readonly knockbackResistance: number;
}

export class MovementComponent {
  private dashEndsAtMs = -1;
  private dashReadyAtMs = -1;
  private knockbackEndsAtMs = -1;
  private readonly facing = new Phaser.Math.Vector2(0, 1);

  constructor(
    private readonly body: Phaser.Physics.Arcade.Body,
    private readonly config: MovementConfig,
  ) {
    this.body.setDamping(false);
    this.body.setDrag(config.drag, config.drag);
    this.body.setMaxVelocity(config.dashSpeed, config.dashSpeed);
  }

  get facingVector(): Phaser.Math.Vector2 {
    return this.facing;
  }

  isDashing(nowMs: number): boolean {
    return nowMs < this.dashEndsAtMs;
  }

  isKnockedBack(nowMs: number): boolean {
    return nowMs < this.knockbackEndsAtMs;
  }

  dashCooldownRemaining(nowMs: number): number {
    return Math.max(0, this.dashReadyAtMs - nowMs);
  }

  canDash(nowMs: number): boolean {
    return nowMs >= this.dashReadyAtMs && !this.isDashing(nowMs);
  }

  /** inputX/inputY are raw axis values; diagonals are normalized so they are not faster. */
  move(
    inputX: number,
    inputY: number,
    speedMultiplier: number,
    nowMs: number,
  ): void {
    if (this.isDashing(nowMs) || this.isKnockedBack(nowMs)) return;

    const lengthSq = inputX * inputX + inputY * inputY;
    if (lengthSq < 0.0001) {
      this.body.setAcceleration(0, 0);
      return;
    }

    const inverseLength = 1 / Math.sqrt(lengthSq);
    const dirX = inputX * inverseLength;
    const dirY = inputY * inverseLength;
    this.facing.set(dirX, dirY);

    const maxSpeed = this.config.moveSpeed * speedMultiplier;
    this.body.setMaxVelocity(maxSpeed, maxSpeed);
    this.body.setAcceleration(
      dirX * this.config.acceleration,
      dirY * this.config.acceleration,
    );
  }

  /** Direct velocity set for AI that does not need acceleration smoothing. ignoreKnockback lets a
   *  committed movement (a boss charge) push through a stray hit instead of stuttering to a halt. */
  moveDirect(
    dirX: number,
    dirY: number,
    speed: number,
    nowMs: number,
    ignoreKnockback = false,
  ): void {
    if (
      this.isDashing(nowMs) ||
      (!ignoreKnockback && this.isKnockedBack(nowMs))
    )
      return;
    const lengthSq = dirX * dirX + dirY * dirY;
    if (lengthSq < 0.0001) {
      this.body.setVelocity(0, 0);
      return;
    }
    const inverseLength = 1 / Math.sqrt(lengthSq);
    this.facing.set(dirX * inverseLength, dirY * inverseLength);
    this.body.setMaxVelocity(speed, speed);
    this.body.setVelocity(this.facing.x * speed, this.facing.y * speed);
  }

  stop(): void {
    this.body.setAcceleration(0, 0);
    this.body.setVelocity(0, 0);
  }

  dash(dirX: number, dirY: number, nowMs: number): boolean {
    if (!this.canDash(nowMs)) return false;

    let x = dirX;
    let y = dirY;
    if (x * x + y * y < 0.0001) {
      x = this.facing.x;
      y = this.facing.y;
    }
    const inverseLength = 1 / Math.sqrt(x * x + y * y);
    this.facing.set(x * inverseLength, y * inverseLength);

    this.body.setMaxVelocity(this.config.dashSpeed, this.config.dashSpeed);
    this.body.setAcceleration(0, 0);
    this.body.setVelocity(
      this.facing.x * this.config.dashSpeed,
      this.facing.y * this.config.dashSpeed,
    );
    this.dashEndsAtMs = nowMs + this.config.dashDurationMs;
    this.dashReadyAtMs = nowMs + this.config.dashCooldownMs;
    return true;
  }

  applyKnockback(
    fromX: number,
    fromY: number,
    force: number,
    nowMs: number,
    durationMs = 140,
  ): void {
    if (force <= 0) return;
    const dx = this.body.center.x - fromX;
    const dy = this.body.center.y - fromY;
    const length = Math.hypot(dx, dy) || 1;
    const scaled = force * (1 - this.config.knockbackResistance);
    this.body.setAcceleration(0, 0);
    this.body.setMaxVelocity(Math.max(scaled, this.config.dashSpeed));
    this.body.setVelocity((dx / length) * scaled, (dy / length) * scaled);
    this.knockbackEndsAtMs = nowMs + durationMs;
  }

  reset(): void {
    this.dashEndsAtMs = -1;
    this.dashReadyAtMs = -1;
    this.knockbackEndsAtMs = -1;
    this.stop();
  }
}
