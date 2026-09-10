import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
icons = len(sys.argv) > 2 and sys.argv[2] == "icons"
menu = len(sys.argv) > 2 and sys.argv[2] == "menu"
STORAGE = ROOT / (".diffui/classic-menu" if menu else ".diffui/classic-icons" if icons else ".diffui/classic")
STORAGE.mkdir(parents=True, exist_ok=True)
token = re.search(r"authToken=([A-Za-z0-9_-]+)", Path(sys.argv[1]).read_text()).group(1)
prompt = """Recreate the supplied reference as a clean, text-free, fixed-resolution game interface artwork plate, exactly 1920 pixels wide and 1088 high. Preserve the reference's exact composition, geometry, placement and proportions. This is a Warcraft III classic human menu skin: dark forged iron, thick cool steel bevels, small bronze rivets, worn dark wood inset and nearly black green slate. The metal is dark and matte, with restrained edge highlights. All text, letters, numbers, avatars and pictogram icons are cleared away to leave blank surfaces ready for live HTML content. Keep the blue menu button faces empty and their metallic rims intact. The original reference itself supplies every visual detail; reproduce its structure closely.

Exact layout: full horizontal header occupies x0 to1635, y0 to130. Lion-head iron medallions remain at the upper left x0 y0, and upper right x1785 y0, each about140 pixels. The dark title plaque is x180 y32 width410 height72. Four empty royal blue button faces are x610 y42 width215 height53, x849 y42 width203 height53, x1076 y42 width198 height53, x1304 y42 width182 height53. The left conversation window occupies x22 y174 width536 height835. Its blank wood and iron title band occupies y190 to270. Its dark content well occupies x61 y280 width445 height607. A blank blue bottom button occupies x85 y909 width399 height50, with thick iron housing. The large right chat window occupies x563 y172 width1334 height855. Its header is a dark empty inset from x597 y202 to1854 y298, with an empty small square icon socket at x610 y218 and an empty blue View Files button at x1684 y227 width150 height39. The large conversation well is x614 y324 width1220 height528, EMPTY: clear all internal message outlines, portraits, lettering and status elements, retain only its outer thin steel outline. The bottom composer occupies x615 y902 to1620 y979, with an empty small square parchment icon socket at the left. An empty blue send button occupies x1650 y915 width187 height48 inside thick metal housing. The two windows have substantial layered 20 to35 pixel thick iron frames. Preserve the heavy chains suspending both windows and the ornate wrought iron scrollwork at the very bottom corners. The selected conversation row highlight is cleared so live content can select any row.

The outer empty areas and all dark content wells have real alpha transparency; keep only the physical iron, wood, blue button faces and decorative metal pieces opaque. Empty text surfaces on blue buttons and dark wood remain blank. Front-on, orthographic, clean high-resolution game UI asset with the SAME geometry as the reference, neutral diffuse illumination suitable for relighting."""

def post(endpoint, payload):
    request = urllib.request.Request("https://diffui.ai/api/build/" + endpoint, data=json.dumps({"authToken": token, **payload}).encode(), headers={"Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=420) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if endpoint != "generate-image" or error.code != 524 or attempt == 4:
                raise
            time.sleep(5)

def download(url, path):
    for attempt in range(7):
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                path.write_bytes(response.read())
            return
        except urllib.error.HTTPError as error:
            if error.code not in (404, 429, 502, 503) or attempt == 6:
                raise
            time.sleep(5 + attempt * 3)

if icons:
    prompt = """Create a game UI icon sprite sheet matching the small hand-painted inventory and menu icons in the supplied Warcraft III reference. Exactly 2048 wide by1536 high, a perfectly regular grid of FOUR columns and THREE rows, each cell exactly512 square. Each icon is centered within its cell, isolated on true transparent alpha background, and fits within a320x320 square with ample transparent padding. All cells and gaps are transparent. Icons are chunky, dimensional, hand-painted early 2000s Warcraft III style with dark outlines, aged gold, bright polished bevels, front-on view. No frames or button backgrounds, no lettering or labels, just the12 isolated objects. Match the reference's pictograms very closely.
Row1 left to right: 1 a solid sculpted GOLD PLUS SIGN with bevelled chunky rectangular arms; 2 a single diagonal golden SPANNER WRENCH; 3 a gold open FILE FOLDER; 4 a circular eight-toothed SILVER AND GOLD COGWHEEL with dark center hole.
Row2 left to right: 5 a single diagonal polished SILVER SWORD with golden hilt pointing upper right; 6 a rolled golden PARCHMENT SCROLL with small ink scribbles; 7 a solid gold folded PAPER AIRPLANE pointing upper right; 8 two overlapping GOLD CHAT BUBBLES with a small dark ellipsis.
Row3 left to right: 9 a simple bright BLUE PERSON silhouette, round head and shoulders like the reference user avatar; 10 a vivid RED BEETLE bug icon; 11 a silver three-column BAR CHART with rising arrow; 12 a golden CARDBOARD PACKAGE box with dark seams.
Each object has the exact same visual scale, centered at the center of its512pixel cell. Native transparent background. Carefully respect the regular grid and exact count of12 icons."""
reference = "https://diffui.ai/image/Agentic_Development_Interface.webp?authToken=" + token
if menu:
    reference = json.loads((ROOT / ".diffui/classic/art.json").read_text())["url"]
    prompt = """Edit the supplied Warcraft III classic human menu artwork into ONE full-width menu window, with a cleaned horizontal header. Exact output 1920 by1088 pixels. Match the supplied reference's forged iron, worn cool steel bevels, bronze rivets, dark walnut wood, royal-blue enamel buttons and lion-head ornamentation EXACTLY. Front-on orthographic UI artwork, neutral diffuse light for later dynamic relighting. Native transparent alpha outside physical objects, and in the large empty content well. No text, no icons, no letters, no rows, no shadows inside the empty well.

Keep the horizontal top header EXACTLY in its current position: x0 to1635, y0 to130. Preserve the lion heads at x0 and x1785 y0, the long blank title plaque x180 y32 width410 height72, and the FOUR existing empty blue buttons at x610 y42 width215 height53, x849 y42 width203 height53, x1076 y42 width198 height53, x1304 y42 width182 height53. CRITICAL: remove EVERY chain that overlaps the header face, and reconstruct the solid plaque, metal rails, rivets and button edges behind those chains seamlessly. The header's bottom metal rail must be continuous and uninterrupted. Chains attach to the BACK of the top header and only become visible BELOW its lower edge y130. No chain in front of a plaque or a header button. Leave the rightmost chain x1710 suspended from the upper edge in the open space to the right of the header, as in the reference.

Replace BOTH bottom windows with ONE full-width suspended window: outer bounds x22 y174 width1875 height853 (right edge1897, bottom1027). Same ornate corner bevels, iron edging about30 pixels thick, bronze rivets and dark wood strips as the reference. Heavy vertical steel chain segments at x110, x580, x1290, x1710 run from behind the header DOWN to the window top rail at y174; iron attachment rings stay on its top edge. No chains anywhere inside the content well. Keep ornate lower-corner wrought iron decorations.

Inside this single wide window, a SINGLE wide EMPTY dark walnut title band at x58 y205 width1800 height86, framed in thin iron. No small icon socket, no embedded buttons in this title band. Below it ONE large unbroken rectangular empty transparent content well at x62 y324 width1775 height550, ending at y874. This content well has a thin steel bevel outline and a transparent center, with absolutely NO sidebar, NO vertical divider, NO cards and NO text. Below the content well is a dark wood bottom band y896 to986. This bottom band has just ONE blank royal-blue button with an iron housing at x1650 y915 width187 height48, exactly like the reference's send button. The rest of the bottom band is empty dark wood, NO text input and NO square socket. Preserve all these positions carefully so live HTML can sit inside the original1920x1088 coordinates. This is a single wide WINDOW asset, not a screenshot, with real transparent alpha outside the metal artwork and inside its content well."""
record_path = STORAGE / "art.json"
record = json.loads(record_path.read_text()) if record_path.exists() else post("generate-image", {"prompt": prompt, "width": 2048 if icons else 1920, "height": 1536 if icons else 1088, "quality": "high", "transparentBackground": True, "referenceImageUrl": reference})
record_path.write_text(json.dumps(record))
download(record["url"], STORAGE / "art.webp")
print("Fixed composition artwork ready", flush=True)
maps_path = STORAGE / "maps.json"
maps = json.loads(maps_path.read_text()) if maps_path.exists() else post("create-maps", {"imageUrl": record["url"], "maps": ["normal", "height", "roughness"]})
maps_path.write_text(json.dumps(maps))
for material in maps["maps"]:
    download(material["url"], STORAGE / (material["type"] + ".webp"))
print("Normal, height and roughness maps ready", flush=True)
