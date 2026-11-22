import Phaser from 'phaser';
import type { CombatManager, CombatResult } from '../systems/CombatManager';
import { textStyle, pixelCamera, type ViewSize } from '../view';
import type { Party } from '../world/Party';
import type { PartyMember } from '../world/PartyMember';
import { PORTRAIT_SIZE } from './BootScene';

const MARGIN = 6;
const GAP = 4;
const HP_WIDTH = PORTRAIT_SIZE - 2;

interface PortraitView {
  member: PartyMember;
  frame: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Image;
  hpBack: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
}

/** HUD on top of the world: party portraits (click to change leader) and combat banner. */
export class UIScene extends Phaser.Scene {
  private party!: Party;
  private combat!: CombatManager;
  private portraits: PortraitView[] = [];
  private bounds = new Phaser.Geom.Rectangle();
  private nameLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('UI');
  }

  init(data: { party: Party; combat: CombatManager }) {
    this.party = data.party;
    this.combat = data.combat;
    this.portraits = [];
  }

  create() {
    for (const member of this.party.members) {
      const frame = this.add.image(0, 0, 'frame').setOrigin(0).setInteractive({ useHandCursor: true });
      const face = this.add.image(0, 0, `portrait-${member.def.id}`).setOrigin(0);
      const hpBack = this.add.rectangle(0, 0, PORTRAIT_SIZE, 3, 0x0d0b14).setOrigin(0);
      const hpBar = this.add.rectangle(0, 0, HP_WIDTH, 1, 0x6bd96b).setOrigin(0);
      const view = { member, frame, face, hpBack, hpBar };
      frame.on('pointerdown', () => this.party.setLeader(member.def.id));
      frame.on('pointerover', () => this.showName(view));
      frame.on('pointerout', () => this.nameLabel.setVisible(false));
      this.portraits.push(view);
    }

    this.nameLabel = this.add.text(0, 0, '', textStyle(10)).setOrigin(0.5, 1).setVisible(false);
    this.hint = this.add.text(0, 0, '[T] Tactics', textStyle(10, '#b8b0c8')).setOrigin(0, 1);
    this.banner = this.add
      .text(0, 8, '', textStyle(20, '#ffffff', { stroke: '#0d0b14', strokeThickness: 3 }))
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.party.on('leaderChanged', this.refreshLeader, this);
    this.combat.on('combatStart', this.onCombatStart, this);
    this.combat.on('combatEnd', this.onCombatEnd, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.party.off('leaderChanged', this.refreshLeader, this);
      this.combat.off('combatStart', this.onCombatStart, this);
      this.combat.off('combatEnd', this.onCombatEnd, this);
    });

    pixelCamera(this, true, (view) => this.layout(view));
    this.refreshLeader();
  }

  update() {
    for (const p of this.portraits) {
      const m = p.member;
      p.hpBar.setSize(Math.round((HP_WIDTH * m.hp) / m.maxHp), 1);
      p.face.setAlpha(m.alive ? 1 : 0.35);
    }
  }

  /** True if the pointer is over HUD elements (so the world should ignore the click). */
  isOverUI(pointer: Phaser.Input.Pointer): boolean {
    const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return this.bounds.contains(p.x, p.y);
  }

  /** Positions everything for the current view size (game pixels). */
  private layout(view: ViewSize) {
    const y = view.height - MARGIN - PORTRAIT_SIZE - 4; // room for the HP bar
    this.portraits.forEach((p, i) => {
      const x = MARGIN + i * (PORTRAIT_SIZE + GAP);
      p.frame.setPosition(x, y);
      p.face.setPosition(x + 2, y + 2);
      p.hpBack.setPosition(x, y + PORTRAIT_SIZE + 1);
      p.hpBar.setPosition(x + 1, y + PORTRAIT_SIZE + 2);
    });
    const width = this.portraits.length * (PORTRAIT_SIZE + GAP) - GAP;
    this.bounds.setTo(MARGIN, y, width, PORTRAIT_SIZE + 4);
    this.nameLabel.setY(y - 3);
    this.hint.setPosition(MARGIN + width + 8, view.height - MARGIN);
    this.banner.setX(view.width / 2);
  }

  private onCombatStart() {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText('COMBAT').setColor('#ff6b6b').setAlpha(1).setVisible(true);
  }

  private onCombatEnd(result: CombatResult) {
    this.banner.setText(result === 'victory' ? 'VICTORY' : 'DEFEAT').setColor(result === 'victory' ? '#f2d16b' : '#b8b0c8');
    this.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: 1200,
      duration: 500,
      onComplete: () => this.banner.setVisible(false),
    });
  }

  private refreshLeader() {
    for (const p of this.portraits) p.frame.setTexture(p.member === this.party.leader ? 'frame-leader' : 'frame');
  }

  private showName(p: PortraitView) {
    const leader = p.member === this.party.leader ? ' (leader)' : '';
    this.nameLabel
      .setText(`${p.member.def.name}${leader}`)
      .setX(Math.max(p.frame.x + PORTRAIT_SIZE / 2, 40))
      .setVisible(true);
  }
}
