import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'src', 'game', 'data', 'rooms');
const outputDir = join(root, 'public', 'maps');

const TILE = 16;
const GID = { floor: 1, floorAlt: 2, wall: 3, wallTop: 4, doorway: 5, spikeBase: 6, scorched: 7, accent: 8 };

const GROUND_BY_CHAR = {
  '.': GID.floor,
  ',': GID.floorAlt,
  '+': GID.doorway,
  x: GID.spikeBase,
  f: GID.scorched,
  '#': 0,
  ' ': 0,
};

const HAZARD_BY_CHAR = { x: 'hazard_spike', f: 'hazard_fire' };

function property(name, value) {
  if (Array.isArray(value)) return { name, type: 'string', value: JSON.stringify(value) };
  const type = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'string';
  return { name, type, value };
}

function edgeTilesFor(direction, width, height) {
  switch (direction) {
    case 'n':
      return { rows: [0, 1], cols: null };
    case 's':
      return { rows: [height - 2, height - 1], cols: null };
    case 'w':
      return { rows: null, cols: [0, 1] };
    case 'e':
      return { rows: null, cols: [width - 2, width - 1] };
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
}

function findDoorTiles(layout, exit, width, height) {
  const { rows, cols } = edgeTilesFor(exit.direction, width, height);
  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (layout[y][x] !== '+') continue;
      if (rows && !rows.includes(y)) continue;
      if (cols && !cols.includes(x)) continue;
      tiles.push({ x, y });
    }
  }
  if (tiles.length === 0) {
    throw new Error(`Exit ${exit.direction} in room has no '+' doorway tiles on that edge`);
  }
  return tiles;
}

function buildMap(room) {
  const { layout, width, height } = room;
  const ground = new Array(width * height).fill(0);
  const walls = new Array(width * height).fill(0);
  const objects = [];
  let nextId = 1;

  const pushObject = (type, name, tileX, tileY, properties) => {
    objects.push({
      id: nextId++,
      name,
      type,
      x: tileX * TILE,
      y: tileY * TILE,
      width: TILE,
      height: TILE,
      rotation: 0,
      visible: true,
      properties,
    });
  };

  for (let y = 0; y < height; y += 1) {
    const rowText = layout[y];
    if (rowText.length !== width) throw new Error(`${room.id}: row ${y} width ${rowText.length} != ${width}`);

    for (let x = 0; x < width; x += 1) {
      const char = rowText[x];
      const index = y * width + x;

      if (char === '#') {
        const below = y + 1 < height ? rowText[x] && layout[y + 1][x] : '#';
        walls[index] = below === '#' ? GID.wallTop : GID.wall;
        continue;
      }

      const groundGid = GROUND_BY_CHAR[char];
      if (groundGid === undefined) throw new Error(`${room.id}: unknown tile char '${char}' at ${x},${y}`);
      ground[index] = groundGid;

      const hazard = HAZARD_BY_CHAR[char];
      if (hazard) pushObject(hazard, hazard, x, y, [property('phase', (x * 137 + y * 61) % 1600)]);
    }
  }

  for (const object of room.objects ?? []) {
    const properties = [property('id', object.id ?? '')];
    if (object.lootTable) properties.push(property('lootTable', object.lootTable));
    pushObject(object.type, object.id ?? object.type, object.tx, object.ty, properties);
  }

  for (const exit of room.exits ?? []) {
    const tiles = findDoorTiles(layout, exit, width, height);
    for (const tile of tiles) {
      const doorProperties = [
        property('direction', exit.direction),
        property('target', exit.target),
        property('locked', Boolean(exit.locked)),
      ];
      if (exit.channel) doorProperties.push(property('channel', exit.channel));
      pushObject('door', `door_${exit.direction}`, tile.x, tile.y, doorProperties);
    }

    const minX = Math.min(...tiles.map((t) => t.x));
    const maxX = Math.max(...tiles.map((t) => t.x));
    const minY = Math.min(...tiles.map((t) => t.y));
    const maxY = Math.max(...tiles.map((t) => t.y));
    objects.push({
      id: nextId++,
      name: `exit_${exit.direction}`,
      type: 'exit',
      x: minX * TILE,
      y: minY * TILE,
      width: (maxX - minX + 1) * TILE,
      height: (maxY - minY + 1) * TILE,
      rotation: 0,
      visible: true,
      properties: [
        property('direction', exit.direction),
        property('target', exit.target),
        property('locked', Boolean(exit.locked)),
      ],
    });
  }

  const tileLayer = (name, data, id) => ({
    data,
    height,
    width,
    id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    x: 0,
    y: 0,
  });

  return {
    compressionlevel: -1,
    width,
    height,
    tilewidth: TILE,
    tileheight: TILE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    nextlayerid: 4,
    nextobjectid: nextId,
    layers: [
      tileLayer('ground', ground, 1),
      tileLayer('walls', walls, 2),
      {
        draworder: 'topdown',
        id: 3,
        name: 'objects',
        objects,
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
      },
    ],
    tilesets: [
      {
        columns: 8,
        firstgid: 1,
        image: 'runtime-generated',
        imageheight: TILE,
        imagewidth: TILE * 8,
        margin: 0,
        name: 'base',
        spacing: 0,
        tilecount: 8,
        tileheight: TILE,
        tilewidth: TILE,
      },
    ],
  };
}

mkdirSync(outputDir, { recursive: true });
const files = readdirSync(sourceDir).filter((file) => file.endsWith('.json'));
if (files.length === 0) throw new Error(`No room sources in ${sourceDir}`);

for (const file of files) {
  const room = JSON.parse(readFileSync(join(sourceDir, file), 'utf8'));
  const map = buildMap(room);
  writeFileSync(join(outputDir, file), `${JSON.stringify(map)}\n`);
}

console.log(`built ${files.length} Tiled maps -> ${outputDir}`);
