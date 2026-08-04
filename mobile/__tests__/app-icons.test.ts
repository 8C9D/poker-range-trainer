import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { inflateSync } from 'zlib';

import { dark, light } from '../theme/colors';

/**
 * The app's identity assets: the home-screen icon and the launch screen, the two
 * places the product is seen before a single line of its UI renders.
 *
 * Both shipped as the Expo scaffold for the whole build — a blue placeholder "A"
 * on pale blue, next to a cream-and-gold app — because nothing in the toolchain
 * ties a binary asset to the theme, and no screenshot in the test suite reaches
 * the launcher. The web app holds its SVG marks to the palette in
 * `src/cssIntegrity.test.ts`; this is the mobile half, reading the PNGs.
 */

const ASSETS = join(__dirname, '..', 'assets');

/** The two colors every icon here is drawn in: the gold plate and its ink. */
const GOLD = light.goldFill;
const INK = light.onAccent;

interface Pixels {
  width: number;
  height: number;
  /** Row-major RGBA bytes, four per pixel. */
  data: Uint8Array;
}

/**
 * Decode an 8-bit RGBA PNG to raw pixels. Deliberately narrow: every asset here
 * is written that way, and anything else throws instead of being misread as a
 * pass. Chunk layout and the row filters are PNG spec sections 5 and 9.
 */
function decodePng(name: string): Pixels {
  const png = readFileSync(join(ASSETS, name));
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error(`${name} is not a PNG`);

  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  for (let at = 8; at < png.length; at += png.readUInt32BE(at) + 12) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colorType, interlace] = [body[8], body[9], body[12]];
      if (depth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`${name} is not a non-interlaced 8-bit RGBA PNG`);
      }
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(stride * height);
  for (let y = 0, read = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    for (let x = 0; x < stride; x += 1) {
      // The filters predict a byte from its neighbours; RGBA puts the previous
      // pixel four bytes back.
      const left = x >= 4 ? data[y * stride + x - 4] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
      let value = raw[read + x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      data[y * stride + x] = value;
    }
    read += stride;
  }
  return { width, height, data };
}

/** PNG's Paeth predictor: the neighbour nearest to `left + up - upLeft`. */
function paeth(left: number, up: number, upLeft: number): number {
  const guess = left + up - upLeft;
  const dLeft = Math.abs(guess - left);
  const dUp = Math.abs(guess - up);
  const dUpLeft = Math.abs(guess - upLeft);
  if (dLeft <= dUp && dLeft <= dUpLeft) return left;
  return dUp <= dUpLeft ? up : upLeft;
}

/** Every color covering at least `floor` of the solid pixels, and their total share. */
function solidColors(pixels: Pixels, floor: number) {
  const counts = new Map<string, number>();
  let solid = 0;
  for (let i = 0; i < pixels.width * pixels.height; i += 1) {
    // Antialiased edges are neither of the two colors; only fully solid pixels
    // are the icon's actual paint.
    if (pixels.data[i * 4 + 3] < 250) continue;
    solid += 1;
    const hex = `#${[0, 1, 2]
      .map((channel) => pixels.data[i * 4 + channel].toString(16).padStart(2, '0'))
      .join('')}`;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const major = [...counts.entries()].filter(([, n]) => n / solid >= floor);
  return {
    colors: major.sort((a, b) => b[1] - a[1]).map(([hex]) => hex),
    share: major.reduce((sum, [, n]) => sum + n, 0) / solid,
    inkShareOfCanvas: (counts.get(INK) ?? 0) / (pixels.width * pixels.height),
  };
}

/** Each shipped asset and the palette colors it is allowed to be painted in. */
const ICONS: { name: string; colors: string[]; carriesTheMark: boolean }[] = [
  { name: 'icon.png', colors: [GOLD, INK], carriesTheMark: true },
  { name: 'splash-icon.png', colors: [GOLD, INK], carriesTheMark: true },
  { name: 'favicon.png', colors: [GOLD, INK], carriesTheMark: true },
  { name: 'android-icon-background.png', colors: [GOLD], carriesTheMark: false },
  { name: 'android-icon-foreground.png', colors: [INK], carriesTheMark: true },
  { name: 'android-icon-monochrome.png', colors: [INK], carriesTheMark: true },
];

interface AppConfig {
  expo: {
    icon: string;
    backgroundColor: string;
    android: { adaptiveIcon: Record<string, string> };
    web: { favicon: string };
    plugins: (string | [string, Record<string, unknown>])[];
  };
}

const app = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as AppConfig;

describe('app icons', () => {
  it.each(ICONS)('paints $name only in the Coach palette', ({ name, colors }) => {
    const { colors: painted, share } = solidColors(decodePng(name), 0.01);
    expect(painted.sort()).toEqual([...colors].sort());
    // Guards the guard: the majority colors have to be most of the icon, so an
    // asset that had become a gradient could not pass on two stray pixels.
    expect(share).toBeGreaterThan(0.9);
  });

  it.each(ICONS.filter((icon) => icon.carriesTheMark))('draws the spade on $name', ({ name }) => {
    // The scaffold icon this replaced was a wordmark, not a suit; a plain gold
    // plate would be just as wrong. Both miss this band.
    expect(solidColors(decodePng(name), 0.01).inkShareOfCanvas).toBeGreaterThan(0.05);
    expect(solidColors(decodePng(name), 0.01).inkShareOfCanvas).toBeLessThan(0.4);
  });

  it('keeps the iOS app icon free of transparency', () => {
    // App Store validation rejects an icon with any transparent pixel.
    const icon = decodePng('icon.png');
    let clearest = 255;
    for (let i = 0; i < icon.width * icon.height; i += 1) {
      clearest = Math.min(clearest, icon.data[i * 4 + 3]);
    }
    expect(clearest).toBe(255);
    expect(icon.width).toBe(1024);
    expect(icon.height).toBe(1024);
  });

  it('references every asset it ships, and ships every asset it references', () => {
    const shipped = readdirSync(ASSETS).filter((file) => file.endsWith('.png'));
    const referenced = [
      app.expo.icon,
      app.expo.web.favicon,
      ...Object.values(app.expo.android.adaptiveIcon),
      String(splashOptions().image),
    ].filter((value) => value.endsWith('.png'));

    expect(shipped.length).toBe(ICONS.length);
    // Sorted both ways so a dead asset and a broken path each name themselves in
    // the diff. `splash-icon.png` sat here unreferenced for the whole build.
    expect(shipped.map((file) => `./assets/${file}`).sort()).toEqual([...referenced].sort());
  });
});

/** The `expo-splash-screen` plugin's options, which own the native launch screen. */
function splashOptions(): Record<string, unknown> {
  const entry = app.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  if (!Array.isArray(entry)) throw new Error('expo-splash-screen is not configured');
  return entry[1];
}

/**
 * Without the `expo-splash-screen` plugin there is no native launch screen at
 * all: `expo-router`'s `SplashScreen` resolves its native module optionally, so
 * `preventAutoHideAsync`/`hideAsync` in `app/_layout.tsx` quietly become no-ops
 * and the app opens on a system-white frame while the fonts load.
 */
describe('splash screen', () => {
  it('is configured with the app mark on the theme background', () => {
    const options = splashOptions();
    expect(options.image).toBe('./assets/splash-icon.png');
    expect(options.backgroundColor).toBe(light.bg);
    expect((options.dark as { backgroundColor: string }).backgroundColor).toBe(dark.bg);
  });

  it('is declared as a dependency, or its plugin and native module are missing', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['expo-splash-screen']).toBeDefined();
  });
});
