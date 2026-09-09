import concurrent.futures
import json
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/app/public/warcraft"
LEDGER = ROOT / ".diffui/assets.json"
TOKEN = re.search(r"authToken=([A-Za-z0-9_-]+)", Path(sys.argv[1]).read_text()).group(1)
STYLE = "Classic Warcraft III human campaign menu art, hand-painted early 2000s fantasy game UI, chunky forged black iron, hammered blue-grey steel bevels, aged bronze recesses, realistic material detail, front-on orthographic view, balanced diffuse lighting for relighting, no text or letters. "
ASSETS = [
    ("frame", 1024, 1024, True, "A square empty window border. Heavy narrow double-ridged wrought iron rim with small evenly spaced rivets, bevelled clipped corners and restrained gothic flourishes at four corners. The metal occupies only the outermost 10 percent of each side; large completely transparent empty center and transparent outside. Flat straight uninterrupted edges for nine-slice scaling. Frame fills the canvas edge to edge."),
    ("header", 1536, 512, True, "A very wide rectangular horizontal dark wood plaque enclosed in a heavy steel frame with rivets. Thin border, clipped angular corners, small wrought iron scrollwork at each end. Interior is deeply dark horizontally grained walnut, clear and empty for overlay text. Width three times height. Fills canvas with only a tiny transparent outer margin."),
    ("button", 1536, 512, True, "A single wide rectangular blank royal cobalt blue enamel menu button. Deep midnight blue lower face, luminous painted cobalt upper edge, ornate chunky silver iron bevel and thin bronze inner rim, clipped octagonal corners, tiny corner fasteners. Completely empty blue face for overlay label. Three times as wide as tall, fills the canvas with minimal transparent exterior margin."),
    ("chain", 512, 1536, True, "One single perfectly straight vertical length of heavy forged iron chain, twelve interlocked thick oval steel links alternating front and side view, polished edge highlights, dark oxidized crevices. Centered, extends full canvas height, transparent around and through each link. Chain width 140 pixels within 512 pixel wide canvas. No mounting plate."),
    ("lion", 816, 816, True, "One sculpted steel lion head in a round iron medallion, proud imposing face looking directly forward, mane intricately carved in high relief, bronze worn rim, dark iron and silver edges. Isolated with full transparency around the round silhouette. Fills canvas."),
    ("corner", 816, 816, True, "An ornate L-shaped lower-left corner bracket made from interwoven wrought iron scrolls, bevelled steel and bronze engraved ornament. Vertical arm on left and horizontal arm across bottom; open upper right area is fully transparent. Intricate strong carved relief, no frame on top or right. Transparent exterior."),
    ("crest", 816, 816, True, "An alliance-inspired small royal blue kite shield with gold winged edging and one bright central silver sword, wrought steel and aged gold, heraldic fantasy emblem. A compact elegant standalone symmetrical shield without words. Fully transparent background, fills canvas."),
    ("orb", 816, 816, True, "A luminous sapphire blue crystal orb held in a small ornate dark wrought iron circular setting with four silver claws. Deep blue glass and blue light trapped within. Front view, intricate metallic relief, isolated transparent background, compact round silhouette."),
    ("swords", 816, 816, True, "Two crossed steel broadswords with aged golden hilts, a small dark blue shield behind their crossing, chunky hand-painted fantasy game inventory icon, diagonal blades clear and recognizable. Isolated transparent background."),
    ("project", 816, 816, True, "A single golden leather map folio partly open with a rolled parchment and a small cobalt blue wax seal. Chunky hand-painted fantasy game inventory icon with brass fittings, front three-quarter view, isolated transparent background."),
    ("forge", 816, 816, True, "A compact silver metal cogwheel with a golden central hub and a diagonal small smith hammer, chunky hand-painted fantasy game inventory icon, dark iron bevels and silver highlights, isolated transparent background."),
    ("backdrop", 2048, 1536, False, "A quiet almost black medieval castle interior background plate, extremely dark blue-black rough basalt, faint distant pillars at the far left and right edges and soft cool atmospheric mist. Central 80 percent is empty nearly black stone shadow. Subtle moonlit sliver at top, restrained painterly game menu environment, no UI, no words, no foreground objects."),
    ("stone", 1024, 1024, False, "Almost black blue slate stone, medieval carved stone surface, fine uneven rock grain and faint scratched weathering, diffuse neutral lighting, low contrast, no large cracks, seamless repeating material"),
]

def post(endpoint, payload):
    req = urllib.request.Request("https://diffui.ai/api/build/" + endpoint, data=json.dumps({"authToken": TOKEN, **payload}).encode(), headers={"Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=420) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if endpoint != "generate-image" or error.code != 524 or attempt == 4:
                raise
            time.sleep(5)

def download(url, path):
    for attempt in range(7):
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read()
            path.write_bytes(data)
            return
        except urllib.error.HTTPError as error:
            if error.code not in (404, 429, 502, 503) or attempt == 6:
                raise
            time.sleep(5 + attempt * 3)

def generate(item):
    name, width, height, transparent, prompt = item
    record_path = ROOT / ".diffui" / (name + ".json")
    record = json.loads(record_path.read_text()) if record_path.exists() else None
    if record is None:
        if name == "stone":
            record = post("create-texture", {"prompt": prompt, "tilingMode": "both", "maps": ["normal", "height", "roughness"]})
        else:
            record = post("generate-image", {"prompt": STYLE + prompt, "width": width, "height": height, "quality": "high", "transparentBackground": transparent})
        record_path.write_text(json.dumps(record))
    download(record["url"], OUT / (name + ".webp"))
    print(name + ": image ready", flush=True)
    if name != "backdrop":
        maps_path = ROOT / ".diffui" / (name + "-maps.json")
        maps = record if name == "stone" else json.loads(maps_path.read_text()) if maps_path.exists() else post("create-maps", {"imageUrl": record["url"], "maps": ["normal", "height", "roughness"]})
        maps_path.write_text(json.dumps(maps))
        for m in maps["maps"]:
            download(m["url"], OUT / (name + "-" + m["type"] + ".webp"))
        print(name + ": normal, depth and roughness ready", flush=True)
    return {"name": name, "prompt": STYLE + prompt, "width": width, "height": height, "transparent": transparent}

OUT.mkdir(parents=True, exist_ok=True)
LEDGER.parent.mkdir(parents=True, exist_ok=True)
results = []
selected = [item for item in ASSETS if len(sys.argv) < 3 or item[0] in sys.argv[2:]]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    jobs = {pool.submit(generate, item): item[0] for item in selected}
    for job in concurrent.futures.as_completed(jobs):
        try:
            results.append(job.result())
        except Exception as error:
            print(jobs[job] + ": FAILED " + str(error), flush=True)
existing = json.loads(LEDGER.read_text()) if LEDGER.exists() else []
merged = {record["name"]: record for record in existing + results}
LEDGER.write_text(json.dumps(list(merged.values()), indent=2))
print("Completed " + str(len(results)) + " of " + str(len(selected)), flush=True)
sys.exit(0 if len(results) == len(selected) else 1)
