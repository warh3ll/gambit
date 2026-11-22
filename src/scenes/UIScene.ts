import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { CombatManager, CombatResult } from '../systems/CombatManager';
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
  hpBar: Phaser.GameObjects.Rectangle;
}

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '8px',
  color: '#ffffff',
  resolution: 4,
};

/** HUD on top of the world: party portraits (click to change leader) and combat banner. */
export class UIScene extends Phaser.Scene {
  private party!: Party;
  private combat!: CombatManager;
  private portraits: PortraitView[] = [];
  private bounds = new Phaser.Geom.Rectangle();
  private nameLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private combatHint!: Phaser.GameObjects.Text;

  constructor() {
    super('UI');
  }

  init(data: { party: Party; combat: CombatManager }) {
    this.party = data.party;
    this.combat = data.combat;
    this.portraits = [];
  }

  create() {
    const y = GAME_HEIGHT - MARGIN - PORTRAIT_SIZE - 4; // room for the HP bar
    this.party.members.forEach((member, i) => {
      const x = MARGIN + i * (PORTRAIT_SIZE + GAP);
      const frame = this.add.image(x, y, 'frame').setOrigin(0).setInteractive({ useHandCursor: true });
      const face = this.add.image(x + 2, y + 2, `portrait-${member.def.id}`).setOrigin(0);
      this.add.rectangle(x, y + PORTRAIT_SIZE + 1, PORTRAIT_SIZE, 3, 0x0d0b14).setOrigin(0);
      const hpBar = this.add.rectangle(x + 1, y + PORTRAIT_SIZE + 2, HP_WIDTH, 1, 0x6bd96b).setOrigin(0);

      frame.on('pointerdown', () => this.party.setLeader(member.def.id));
      frame.on('pointerover', () => this.showName(member, x));
      frame.on('pointerout', () => this.nameLabel.setVisible(false));
      this.portraits.push({ member, frame, face, hpBar });
    });

    const width = this.party.members.length * (PORTRAIT_SIZE + GAP) - GAP;
    this.bounds.setTo(MARGIN, y, width, PORTRAIT_SIZE + 4);

    this.nameLabel = this.add.text(0, y - 3, '', TEXT_STYLE).setOrigin(0.5, 1).setVisible(false);
    this.banner = this.add
      .text(GAME_WIDTH / 2, 8, '', { ...TEXT_STYLE, fontSize: '10px', stroke: '#0d0b14', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.combatHint = this.add
      .text(GAME_WIDTH / 2, 22, 'Combat actions arrive in M3 - press K to win this fight', {
        ...TEXT_STYLE,
        color: '#d8d0e8',
        stroke: '#0d0b14',
        strokeThickness: 3,
      })
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
    this.refreshLeader();
  }

  update() {
    for (const p of this.portraits) {
      const m = p.member;
      p.hpBar.setSize(Math.round((HP_WIDTH * m.hp) / m.maxHp), 1);
      p.face.setAlpha(m.alive ? 1 : 0.35);
    }
  }

  /** True if a screen-space point is over HUD elements (so the world should ignore the click). */
  isOverUI(x: number, y: number): boolean {
    return this.bounds.contains(x, y);
  }

  private onCombatStart() {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText('COMBAT').setColor('#ff6b6b').setAlpha(1).setVisible(true);
    // Temporary until M3: nobody acts in combat yet, so explain how to get out.
    this.combatHint.setVisible(true);
  }

  private onCombatEnd(result: CombatResult) {
    this.combatHint.setVisible(false);
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

  private showName(member: PartyMember, x: number) {
    const leader = member === this.party.leader ? ' (leader)' : '';
    this.nameLabel
      .setText(`${member.def.name}${leader}`)
      .setX(Math.max(x + PORTRAIT_SIZE / 2, 40))
      .setVisible(true);
  }
}
