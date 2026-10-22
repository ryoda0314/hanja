// アイコンの書き出し：icon.svg を、角丸の icon-192/512.png と、全面に塗って安全域に収めた maskable-512.png に。
// ヘッドレス Chrome で描く。実行: node scripts/icon/render.mjs [Chrome のパス]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../public/icons");
const chrome =
  process.argv[2] ??
  process.env.CHROME ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error("Chrome が見つかりません。パスを引数で渡してください。");
  process.exit(1);
}

const icon = fs.readFileSync(path.join(here, "icon.svg"), "utf8");
// maskable：角を丸めず全面に塗り、絵を中心の円（直径 80%）に収まるよう縮める。
const maskable = icon
  .replace(`rx="112"`, `rx="0"`)
  .replace(`<g id="art"`, `<g transform="translate(256 256) scale(0.82) translate(-256 -260)"><g id="art"`)
  .replace("</svg>", "</g></svg>");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kotonone-icon-"));
const jobs = [
  { svg: icon, png: "icon-512.png", size: 512 },
  { svg: icon, png: "icon-192.png", size: 192 },
  { svg: maskable, png: "maskable-512.png", size: 512 },
];
for (const job of jobs) {
  const svgFile = path.join(tmp, `${job.png}.svg`);
  const htmlFile = path.join(tmp, `${job.png}.html`);
  fs.writeFileSync(svgFile, job.svg);
  fs.writeFileSync(
    htmlFile,
    `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${job.size}px;height:${job.size}px}</style>` +
      `<img src="${pathToFileURL(svgFile).href}">`
  );
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${job.size},${job.size}`,
      `--screenshot=${path.join(out, job.png)}`,
      pathToFileURL(htmlFile).href,
    ],
    { stdio: "ignore" }
  );
  console.log(`  public/icons/${job.png}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
