import Phaser from 'phaser';
import type { Enemy } from '../world/Enemy';
import type { Party } from '../world/Party';
import type { Unit } from '../world/Unit';

export type CombatResult = 'victory' | 'defeat';

/**
 * Decides when fights start and end.
 *
 * A fight starts as soon as any party member comes within an enemy's aggro radius;
 * that enemy's whole group joins. While a fight is on, any other group the party
 * gets close to joins too. The party cannot leave a fight (no escape for now):
 * it ends when every engaged enemy, or every party member, is down.
 *
 * Events: 'combatStart' (enemies), 'groupJoined' (enemies), 'combatEnd' (result).
 */
export class CombatManager extends Phaser.Events.EventEmitter {
  /** Enemies taking part in the current fight. */
  readonly engaged = new Set<Enemy>();
  private readonly party: Party;
  private readonly enemies: Enemy[];
  private active = false;

  constructor(party: Party, enemies: Enemy[]) {
    super();
    this.party = party;
    this.enemies = enemies;
  }

  get inCombat() {
    return this.active;
  }

  update() {
    this.checkEngagement();
    if (this.active) this.checkEnd();
  }

  /** Debug helper until real combat exists (M3): defeats every engaged enemy. */
  debugDefeatEngaged() {
    for (const e of this.engaged) e.takeDamage(e.hp);
  }

  private checkEngagement() {
    const party = this.party.members.filter((m) => m.alive);
    for (const enemy of this.enemies) {
      if (!enemy.alive || this.engaged.has(enemy)) continue;
      if (party.some((m) => dist(m, enemy) <= enemy.def.aggroRadius)) this.engageGroup(enemy.groupId);
    }
  }

  private engageGroup(groupId: string) {
    const joining = this.enemies.filter((e) => e.groupId === groupId && e.alive && !this.engaged.has(e));
    if (!joining.length) return;
    for (const e of joining) {
      this.engaged.add(e);
      e.showHpBar = true;
      e.stop();
      e.faceTowards(nearest(e, this.party.members));
    }

    if (!this.active) {
      this.active = true;
      this.party.enterCombat();
      for (const m of this.party.members) m.faceTowards(nearest(m, [...this.engaged]));
      this.emit('combatStart', joining);
    } else {
      this.emit('groupJoined', joining);
    }
  }

  private checkEnd() {
    const enemiesLeft = [...this.engaged].some((e) => e.alive);
    const partyLeft = this.party.members.some((m) => m.alive);
    if (enemiesLeft && partyLeft) return;

    const result: CombatResult = partyLeft ? 'victory' : 'defeat';
    this.active = false;
    for (const e of this.engaged) e.showHpBar = false;
    this.engaged.clear();
    this.party.exitCombat();
    this.emit('combatEnd', result);
  }
}

const dist = (a: Unit, b: Unit) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest(from: Unit, others: Unit[]): Unit {
  let best = others[0];
  for (const o of others) if (o.alive && dist(from, o) < dist(from, best)) best = o;
  return best;
}
