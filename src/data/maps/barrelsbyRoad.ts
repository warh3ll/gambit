/**
 * THE ROAD FROM BARRELSBY — the vertical slice map.
 *
 * One character per 16px tile. Edit freely: every row must be the same length.
 *
 *   Ground              Blocking            Markers (walkable ground underneath)
 *   .  grass            T  tree             @  party start
 *   ,  flowers          Y  forest tree      w  Wolf
 *   =  road             #  rock             b  Bandit
 *   :  forest floor     ~  water            a  Bandit Archer
 *   +  bridge           H  house            c  Acolyte
 *                       F  fence            S  The Stranger
 *                                           1-9  story trigger (see src/data/story.ts)
 *
 * Enemies standing close together (within 4 tiles of each other) form one group and are fought together.
 * Story triggers play once, when the party leader steps on any tile with that digit.
 */
export const BARRELSBY_ROAD = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT...........,..,...................................~~~.T....YYYY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT....,........,.,....................,.T...T.......~~~.......YY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT..HHHHH..............,T.............,.............~~~....YYY::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT..HHHHH...HHHH........T..............,TT...,......~~~......YYY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT..HHHHH...HHHH...,.....,..........,.TTTTT,...,,T..~~~.....Y.Y:::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT..........HHHH,....................TTTTTTT....T...~~~.......:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'TT.,............,..............,.T...,TTTTT.........~~~......Y:YY:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY:::YYYYYYYY',
  'TT..............,.........,...,.,......TT...,...,...~~~..,....::::YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY::::::Y:YYYY',
  'TT..HHHH..........,.........,.....w.....,...,.......~~~...Y.T.Y:YYYYYYYYYYYYYYYYYYYY::::YYYYYYYYYYYYYYYYYYY::::::::::YYY',
  'TT..HHHH.....HHHH...................w.............,~~~.....YY.:YYYYYYYY::::::::YYY:::::::YYYYYYYYYYYYYYYY:::::::::::::YY',
  'TT..HHHH.....HHHH............................,.....~~~.......T:YYYYYY1::======:::::::b:::::YYYYYYYYYYYYYY:::::::::::::YY',
  'TT.....,.....HHHH.....,.,.....,..........,,......,.~~~,..Y.T..:YYYY::1=============::::::::::YYYYYYYYYYYY:::::c:::::::YY',
  'TT..........................=====..........,.......~~~,.....Y.:YY:::=1=================:::::YYYYYYYYYYYY::::::::::::::YY',
  'TT..,..................,.==========.....,........##~~..##..Y.:::::===1=====:=============c:::YYYYY::2:::::::::::::::::YY',
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
];
