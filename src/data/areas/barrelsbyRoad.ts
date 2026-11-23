/**
 * THE ROAD FROM BARRELSBY — the vertical slice area.
 *
 * Map: one character per 16px tile; every row must be the same length.
 *
 *   Ground              Blocking            Shared markers
 *   .  grass            T  tree             @  party start (new game)
 *   ,  flowers          Y  forest tree      w  Wolf          b  Bandit
 *   =  road             #  rock             a  Bandit Archer c  Acolyte
 *   :  forest floor     ~  water
 *   +  bridge           H  house
 *   _  floor (inside)   F  fence
 *                       W  wall (inside)
 *                       O  furniture
 *
 * This area's own markers are in `legend` below (exits, NPCs, story triggers, the Stranger).
 * Enemies within 4 tiles of each other form one group. Groups respawn every time the area is entered,
 * except groups marked `unique` in `encounters`, which stay beaten.
 */
import type { AreaDef } from './types';

export const BARRELSBY_ROAD: AreaDef = {
  id: 'barrelsbyRoad',
  name: 'The Road from Barrelsby',
  kind: 'outdoor',
  legend: {
    D: { exit: { to: 'martaHouse', at: 'door' }, tile: 'Door' }, // Marta's front door
    d: { start: 'martaDoor' }, // where you come out of Marta's house
    n: { npc: 'villager' },
    S: { enemy: 'stranger', group: 'stranger' },
    '1': { trigger: 'forestEdge' },
    '2': { trigger: 'meetStranger' },
  },
  encounters: {
    stranger: { unique: true, onWin: 'strangerDefeated' },
  },
  map: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT...........,..,...................................~~~.T....YYYY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT....,........,.,....................,.T...T.......~~~.......YY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT..HHHHH..............,T.............,.............~~~....YYY::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT..HHHHH...HHHH........T..............,TT...,......~~~......YYY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT..HHHHH...HHHH...,.....,..........,.TTTTT,...,,T..~~~.....Y.Y:::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT..........HDHH,....................TTTTTTT....T...~~~.......:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT.,.........d..,..............,.T...,TTTTT.........~~~......Y:YY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY:::YYYYYYYY',
    'TT..............,.........,...,.,......TT...,...,...~~~..,....::::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY::::::Y:YYYY',
    'TT..HHHH..........,.........,.....w.....,...,.......~~~...Y.T.Y:YYYYYYYYYYYYYYYYYYYY::::YYYYYYYYYYYYYYYYYYY::::::::::YYY',
    'TT..HHHH.....HHHH...................w.............,~~~.....YY.:YYYYYYYY::::::::YYY:::::::YYYYYYYYYYYYYYYY:::::::::::::YY',
    'TT..HHHH.....HHHH............................,.....~~~.......T:YYYYYY1::======:::::::b:::::YYYYYYYYYYYYYY:::::::::::::YY',
    'TT.....,.....HHHH.....,.,.....,..........,,......,.~~~,..Y.T..:YYYY::1=============::::::::::YYYYYYYYYYYY:::::c:::::::YY',
    'TT..........................=====..........,.......~~~,.....Y.:YY:::=1=================:::::YYYYYYYYYYYY::::::::::::::YY',
    'TT..,.............n....,.==========.....,........##~~..##..Y.:::::===1=====:=============c:::YYYYY::2:::::::::::::::::YY',
    'TT.....,..............========.=======............~~~.....,b:========1===::::::::=========:::YY::::=2=======::::::::::YY',
    'TT=============@===========.......======.....,....~~~......==========1=:::YYYYY:::::========::::====2=======:b:::S::::YY',
    'TT=====================.............=======...====+++==========a=====1::YYYYYYY:::::::b=============2=======::::::::::YY',
    'TT...................................T.===========+++==========::::::1YYYYYYYYYYY:::::::============2=::::::::::::::::YY',
    'TT.FFFFFFF..............................T=======..~~~.T..Y.:..::YYYYYYYYYYYYYYYYYYYYY::::==========:2::Y::::::::::::::YY',
    'TT.........FFFFFFF.......T..........,............##~~..#...bY.:Y::YYYYYYYYYYYYYYYYYYYYYY:::=====::::YYYY::::::c:::::::YY',
    'TT...,.............,.....,..........T....,......,.~~~.,.#....Y:YY:YYYYYYYYYYYYYYYYYYYYYYYY:::::::YYYYYYY:::::::::::::YYY',
    'TT..HHHHH...........................,.,......,...,~~~.........:Y::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY:::::::::::YYY',
    'TT..HHHHH...HHHHH........................,..,......~~~...,.Y.,YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY:::::::::::YYY',
    'TT..HHHHH...HHHHH..................................~~~.,.....YY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY:Y:::::Y:YYYY',
    'TT....,.....HHHHH....,.....~~~~~~~,...,....TTTTT,..~~~....,YYYY::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY::YYYYYYY',
    'TT,.,..............,......~~~~~~~~~.......TTTTTTT...~~~....,.Y:Y:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT.............,......T,.~~~~~~~~~~~.......TTTTT....~~~....YYY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT,..................TTT..~~~~~~~~~.T.......TT....,.~~~...Y,..YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT.............,.....TTTT..~~~~~~~................T.~~~......Y::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT...................TTT................T.,.........~~~......YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT................,...T,.........,............,.....~~~,.Y.,Y,Y:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TT....,.............................,...........,...~~~....YYY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  ],
};
