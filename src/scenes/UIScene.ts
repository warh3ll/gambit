import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import type { Party } from '../world/Party';
import type { PartyMember } from '../world/PartyMember';
import { PORTRAIT_SIZE } from './BootScene';

const MARGIN = 6;
const GAP = 4;

interface PortraitView {
  member: PartyMember;
  frame: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Rectangle;
}

/** HUD drawn on top of the world: party portraits (click one to make it the leader). */
export class UIScene extends Phaser.Scene {
  private party!: Party;
  private portraits: PortraitView[] = [];
  private bounds = new Phaser.Geom.Rectangle();
  private nameLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('UI');
  }

  init(data: { party: Party }) {
    this.party = data.party;
    this.portraits = [];
  }

  create() {
    const y = GAME_HEIGHT - MARGIN - PORTRAIT_SIZE - 4; // room for the HP bar
    this.party.members.forEach((member, i) => {
      const x = MARGIN + i * (PORTRAIT_SIZE + GAP);
      const frame = this.add.image(x, y, 'frame').setOrigin(0).setInteractive({ useHandCursor: true });
      this.add.image(x + 2, y + 2, `portrait-${member.def.id}`).setOrigin(0);
      this.add.rectangle(x, y + PORTRAIT_SIZE + 1, PORTRAIT_SIZE, 3, 0x0d0b14).setOrigin(0);
      // HP is always full until combat exists (M2).
      const hpBar = this.add.rectangle(x + 1, y + PORTRAIT_SIZE + 2, PORTRAIT_SIZE - 2, 1, 0x6bd96b).setOrigin(0);

      frame.on('pointerdown', () => this.party.setLeader(member.def.id));
      frame.on('pointerover', () => this.showName(member, x));
      frame.on('pointerout', () => this.nameLabel.setVisible(false));
      this.portraits.push({ member, frame, hpBar });
    });

    const width = this.party.members.length * (PORTRAIT_SIZE + GAP) - GAP;
    this.bounds.setTo(MARGIN, y, width, PORTRAIT_SIZE + 4);

    this.nameLabel = this.add
      .text(0, y - 3, '', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', resolution: 4 })
      .setOrigin(0.5, 1)
      .setVisible(false);

    this.party.on('leaderChanged', this.refresh, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.party.off('leaderChanged', this.refresh, this));
    this.refresh();
  }

  /** True if a screen-space point is over HUD elements (so the world should ignore the click). */
  isOverUI(x: number, y: number): boolean {
    return this.bounds.contains(x, y);
  }

  private refresh() {
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
