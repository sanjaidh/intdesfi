"""
AI Interior Designer - Flask Backend
=====================================
Main Flask application with all API endpoints.
Includes AI Room Transformation via Replicate API.
"""

import os
import json
import random
import base64
import io
import hashlib
import time
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import requests as http_requests
except ImportError:
    http_requests = None

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Stability AI API config
STABILITY_API_KEY = os.environ.get('STABILITY_API_KEY', '')
GENERATION_CACHE = {}  # SHA256 -> { url, timestamp }
CACHE_TTL = 3600       # 1 hour
MAX_IMAGE_SIZE = (768, 768)
GENERATION_TIMEOUT = 55  # seconds

# Output directory for generated images
GENERATED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generated')
os.makedirs(GENERATED_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# MOCK DATA: AI-Generated Interior Design Images (Unsplash)
# ─────────────────────────────────────────────────────────────────────────────

DESIGN_IMAGES = {
    "modern": [
        {
            "id": "m1",
            "url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80",
            "label": "Modern Minimalist",
            "prompt": "Sleek modern living room with clean lines and neutral tones"
        },
        {
            "id": "m2",
            "url": "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80",
            "label": "Urban Contemporary",
            "prompt": "Urban contemporary space with bold accents and open floor plan"
        },
        {
            "id": "m3",
            "url": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
            "label": "Modern Luxe",
            "prompt": "Modern luxury interior with statement furniture pieces"
        },
        {
            "id": "m4",
            "url": "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80",
            "label": "Nordic Modern",
            "prompt": "Scandinavian-inspired modern room with light wood and white palette"
        }
    ],
    "minimal": [
        {
            "id": "min1",
            "url": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
            "label": "Pure Minimal",
            "prompt": "Minimalist room with essential furniture and tons of negative space"
        },
        {
            "id": "min2",
            "url": "https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=800&q=80",
            "label": "Zen Simplicity",
            "prompt": "Zen-inspired minimalist space with natural materials"
        },
        {
            "id": "min3",
            "url": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80",
            "label": "Monochrome Minimal",
            "prompt": "Monochromatic minimalist design with textural interest"
        },
        {
            "id": "min4",
            "url": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=80",
            "label": "Japandi Style",
            "prompt": "Japandi fusion minimal design with warm wood and muted tones"
        }
    ],
    "traditional": [
        {
            "id": "t1",
            "url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
            "label": "Classic Heritage",
            "prompt": "Classic traditional interior with ornate wood furniture and rich fabrics"
        },
        {
            "id": "t2",
            "url": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
            "label": "Colonial Charm",
            "prompt": "Colonial-inspired traditional room with antique accents"
        },
        {
            "id": "t3",
            "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80",
            "label": "Rustic Traditional",
            "prompt": "Rustic traditional interior with exposed beams and warm colors"
        },
        {
            "id": "t4",
            "url": "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&q=80",
            "label": "Victorian Elegance",
            "prompt": "Victorian-inspired traditional room with detailed millwork"
        }
    ],
    "luxury": [
        {
            "id": "l1",
            "url": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
            "label": "Grand Luxury",
            "prompt": "Opulent luxury suite with gold accents and marble surfaces"
        },
        {
            "id": "l2",
            "url": "https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&q=80",
            "label": "Hotel Luxury",
            "prompt": "5-star hotel inspired luxury living space with bespoke furniture"
        },
        {
            "id": "l3",
            "url": "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800&q=80",
            "label": "Art Deco Glam",
            "prompt": "Art deco glamour with geometric patterns and metallic finishes"
        },
        {
            "id": "l4",
            "url": "https://images.unsplash.com/photo-1616137466211-f939a420be84?w=800&q=80",
            "label": "Contemporary Luxury",
            "prompt": "Contemporary luxury with curated art and designer pieces"
        }
    ],
    "scandinavian": [
        {
            "id": "s1",
            "url": "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80",
            "label": "Nordic Light",
            "prompt": "Scandinavian light-filled room with blonde wood and white linen"
        },
        {
            "id": "s2",
            "url": "https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=800&q=80",
            "label": "Hygge Haven",
            "prompt": "Cozy hygge-inspired space with soft textures and warm neutrals"
        },
        {
            "id": "s3",
            "url": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
            "label": "Minimal Nordic",
            "prompt": "Clean Scandinavian room with functional beauty and natural light"
        },
        {
            "id": "s4",
            "url": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=80",
            "label": "Japandi Fusion",
            "prompt": "Japandi fusion with Nordic simplicity and Japanese wabi-sabi"
        }
    ]
}

# ─────────────────────────────────────────────────────────────────────────────
# MOCK DATA: AI Recommendations per Style
# ─────────────────────────────────────────────────────────────────────────────

RECOMMENDATIONS = {
    "modern": [
        {"icon": "💡", "title": "Lighting Strategy", "text": "Use recessed LED lighting combined with a statement pendant to create depth and visual interest."},
        {"icon": "🪟", "title": "Open Space Flow", "text": "Remove heavy curtains and opt for sheer panels to maximize natural light — a hallmark of modern design."},
        {"icon": "🎨", "title": "Color Palette", "text": "Anchor the space with a neutral base (white/grey), then add a single bold accent color through accessories."},
        {"icon": "🪴", "title": "Biophilic Touch", "text": "Introduce 2–3 large-leaf plants (Monstera, Fiddle Leaf Fig) to soften the hard lines of modern furniture."},
        {"icon": "🛋️", "title": "Furniture Placement", "text": "Float furniture away from walls to create conversation zones and improve traffic flow through the room."}
    ],
    "minimal": [
        {"icon": "✨", "title": "Declutter First", "text": "Apply the 'one surface, one item' rule. Every visible surface should have at most one decorative object."},
        {"icon": "📐", "title": "Negative Space", "text": "Intentional empty space is a design element — resist the urge to fill every corner."},
        {"icon": "🌿", "title": "Natural Materials", "text": "Use raw wood, linen, and stone to add warmth without visual noise."},
        {"icon": "🔲", "title": "Tonal Palette", "text": "Work within a 3-color tonal palette. Vary texture rather than color for visual interest."},
        {"icon": "📦", "title": "Hidden Storage", "text": "Invest in built-ins and furniture with concealed storage to maintain the clean aesthetic."}
    ],
    "traditional": [
        {"icon": "🪵", "title": "Rich Wood Tones", "text": "Layer different wood tones (mahogany, walnut, oak) for depth — traditional rooms embrace warm wood variety."},
        {"icon": "🏺", "title": "Symmetry & Balance", "text": "Traditional design thrives on symmetry. Pair lamps, art, and accessories for a balanced, formal look."},
        {"icon": "🎀", "title": "Fabric & Texture", "text": "Incorporate velvet, brocade, and damask fabrics in rich jewel tones: navy, burgundy, or forest green."},
        {"icon": "🖼️", "title": "Gallery Wall", "text": "Create a curated gallery wall with gilded frames and classic artwork to honor the traditional aesthetic."},
        {"icon": "🕯️", "title": "Warm Ambiance", "text": "Layer lighting with table lamps, sconces, and candles to create the warm, inviting glow of traditional spaces."}
    ],
    "luxury": [
        {"icon": "✨", "title": "Statement Pieces", "text": "Invest in one or two hero furniture pieces (a designer sofa or a sculptural coffee table) — luxury is about quality, not quantity."},
        {"icon": "🪞", "title": "Mirror Magic", "text": "Install oversized mirrors with metallic frames to amplify light, create depth, and add glamour instantly."},
        {"icon": "🎭", "title": "Layered Textiles", "text": "Layer high-thread-count linens, cashmere throws, and silk cushions for a tactile, sumptuous experience."},
        {"icon": "💎", "title": "Metallic Accents", "text": "Use brushed gold or polished chrome hardware on furniture and fixtures for a cohesive, high-end finish."},
        {"icon": "🌹", "title": "Fresh Florals", "text": "A large, fresh floral arrangement in a sculptural vase adds life and a hotel-lobby sophistication to any luxury room."}
    ],
    "scandinavian": [
        {"icon": "🌿", "title": "Natural Palette", "text": "Stick to whites, warm greys, and blonde wood tones. Let nature's own colours be your palette."},
        {"icon": "🕯️", "title": "Hygge Lighting", "text": "Layer candles, warm-toned bulbs, and pendant lamps to create that iconic Scandinavian cosiness."},
        {"icon": "🧶", "title": "Textural Warmth", "text": "Chunky knit throws, sheepskin rugs, and linen cushions add warmth without visual clutter."},
        {"icon": "🪴", "title": "Bring Nature In", "text": "Potted plants, dried flowers, and natural materials connect your interior to the Nordic outdoors."},
        {"icon": "📐", "title": "Functional Beauty", "text": "Every piece should serve a purpose. If it is not useful or deeply loved, it does not belong."}
    ]
}

# ─────────────────────────────────────────────────────────────────────────────
# MOCK DATA: Products per Style
# ─────────────────────────────────────────────────────────────────────────────

PRODUCTS = {
    "modern": [
        {"id": "mp1", "name": "Scandinavian Sectional Sofa", "price": 109000, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80",
         "link": "https://www.amazon.in/s?k=modern+sectional+sofa"},
        {"id": "mp2", "name": "Concrete Effect Coffee Table", "price": 37800, "category": "Tables",
         "image": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80",
         "link": "https://www.amazon.in/s?k=concrete+coffee+table"},
        {"id": "mp3", "name": "Pendant Arc Floor Lamp", "price": 15900, "category": "Lighting",
         "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&q=80",
         "link": "https://www.amazon.in/s?k=arc+floor+lamp+modern"},
        {"id": "mp4", "name": "Geometric Wool Area Rug 6x4ft", "price": 25100, "category": "Rugs",
         "image": "https://images.unsplash.com/photo-1575414003224-04f490d2534a?w=400&q=80",
         "link": "https://www.amazon.in/s?k=geometric+wool+rug"},
        {"id": "mp5", "name": "Floating Wall Shelves Set", "price": 10100, "category": "Storage",
         "image": "https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?w=400&q=80",
         "link": "https://www.amazon.in/s?k=floating+wall+shelves"},
        {"id": "mp6", "name": "Abstract Canvas Art Print", "price": 7100, "category": "Decor",
         "image": "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=80",
         "link": "https://www.amazon.in/s?k=abstract+canvas+art"}
    ],
    "minimal": [
        {"id": "minp1", "name": "Linen Low-Profile Sofa", "price": 75500, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80",
         "link": "https://www.amazon.in/s?k=minimalist+sofa"},
        {"id": "minp2", "name": "Solid Oak Dining Table", "price": 50400, "category": "Tables",
         "image": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=400&q=80",
         "link": "https://www.amazon.in/s?k=solid+oak+dining+table"},
        {"id": "minp3", "name": "Washi Paper Pendant Light", "price": 6300, "category": "Lighting",
         "image": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&q=80",
         "link": "https://www.amazon.in/s?k=paper+pendant+light"},
        {"id": "minp4", "name": "Natural Jute Floor Rug", "price": 12200, "category": "Rugs",
         "image": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
         "link": "https://www.amazon.in/s?k=jute+rug"},
        {"id": "minp5", "name": "Fiddle Leaf Fig Plant (Large)", "price": 5500, "category": "Plants",
         "image": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&q=80",
         "link": "https://www.amazon.in/s?k=fiddle+leaf+fig+plant"},
        {"id": "minp6", "name": "Boucle Accent Chair", "price": 29300, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&q=80",
         "link": "https://www.amazon.in/s?k=boucle+accent+chair"}
    ],
    "traditional": [
        {"id": "tp1", "name": "Chesterfield Leather Sofa", "price": 159600, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&q=80",
         "link": "https://www.amazon.in/s?k=chesterfield+leather+sofa"},
        {"id": "tp2", "name": "Mahogany Dining Set (6-chair)", "price": 184800, "category": "Tables",
         "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80",
         "link": "https://www.amazon.in/s?k=mahogany+dining+table+set"},
        {"id": "tp3", "name": "Crystal Chandelier", "price": 46200, "category": "Lighting",
         "image": "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400&q=80",
         "link": "https://www.amazon.in/s?k=crystal+chandelier"},
        {"id": "tp4", "name": "Persian Mosaic Area Rug", "price": 58800, "category": "Rugs",
         "image": "https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80",
         "link": "https://www.amazon.in/s?k=persian+area+rug"},
        {"id": "tp5", "name": "Antique Gold Frame Mirror", "price": 23100, "category": "Decor",
         "image": "https://images.unsplash.com/photo-1618220252344-8ec99ec624b1?w=400&q=80",
         "link": "https://www.amazon.in/s?k=antique+gold+mirror"},
        {"id": "tp6", "name": "Wingback Accent Chair", "price": 54600, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80",
         "link": "https://www.amazon.in/s?k=wingback+accent+chair"}
    ],
    "luxury": [
        {"id": "lp1", "name": "Italian Velvet Sofa (3-seater)", "price": 294000, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400&q=80",
         "link": "https://www.amazon.in/s?k=luxury+velvet+sofa"},
        {"id": "lp2", "name": "Marble & Brass Coffee Table", "price": 109200, "category": "Tables",
         "image": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80",
         "link": "https://www.amazon.in/s?k=marble+brass+coffee+table"},
        {"id": "lp3", "name": "Designer Beaded Chandelier", "price": 157500, "category": "Lighting",
         "image": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&q=80",
         "link": "https://www.amazon.in/s?k=luxury+designer+chandelier"},
        {"id": "lp4", "name": "Hand-Knotted Silk Rug 8x5ft", "price": 210000, "category": "Rugs",
         "image": "https://images.unsplash.com/photo-1575414003224-04f490d2534a?w=400&q=80",
         "link": "https://www.amazon.in/s?k=hand+knotted+silk+rug"},
        {"id": "lp5", "name": "Original Oil Painting (Large)", "price": 159600, "category": "Art",
         "image": "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=80",
         "link": "https://www.amazon.in/s?k=luxury+oil+painting"},
        {"id": "lp6", "name": "Pure Cashmere Throw Blanket", "price": 32400, "category": "Textiles",
         "image": "https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=400&q=80",
         "link": "https://www.amazon.in/s?k=cashmere+throw+blanket"}
    ],
    "scandinavian": [
        {"id": "sp1", "name": "Light Oak Sofa Frame", "price": 89000, "category": "Seating",
         "image": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80",
         "link": "https://www.amazon.in/s?k=scandinavian+sofa"},
        {"id": "sp2", "name": "Birch Round Dining Table", "price": 42000, "category": "Tables",
         "image": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=400&q=80",
         "link": "https://www.amazon.in/s?k=scandinavian+dining+table"},
        {"id": "sp3", "name": "Woven Pendant Lamp", "price": 8400, "category": "Lighting",
         "image": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&q=80",
         "link": "https://www.amazon.in/s?k=scandinavian+pendant+lamp"},
        {"id": "sp4", "name": "Sheepskin Throw Rug", "price": 14700, "category": "Rugs",
         "image": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
         "link": "https://www.amazon.in/s?k=sheepskin+rug"},
        {"id": "sp5", "name": "Ceramic Planter Set (3)", "price": 4200, "category": "Decor",
         "image": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&q=80",
         "link": "https://www.amazon.in/s?k=scandinavian+planter"},
        {"id": "sp6", "name": "Chunky Knit Throw Blanket", "price": 6300, "category": "Textiles",
         "image": "https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=400&q=80",
         "link": "https://www.amazon.in/s?k=chunky+knit+throw"}
    ]
}

# ─────────────────────────────────────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """Serve the main frontend application."""
    return send_from_directory('../frontend', 'index.html')


@app.route('/room-planner')
def room_planner():
    """Serve the 3D Room Planner page."""
    return send_from_directory('../frontend', 'room-planner.html')


@app.route('/room-transform')
def room_transform():
    """Serve the AI Room Transformation page."""
    return send_from_directory('../frontend', 'room-transform.html')


@app.route('/api/generate-design', methods=['POST'])
def generate_design():
    """
    Generate multiple interior design variations based on uploaded image + style.
    Input: multipart/form-data with 'image' file and 'style' field
    Output: { images: [...], style: "modern", prompt_used: "..." }
    """
    try:
        style = request.form.get('style', 'modern').lower()

        # Validate style
        if style not in DESIGN_IMAGES:
            return jsonify({"error": f"Unknown style: {style}"}), 400

        # Get design images for this style (shuffle for variety)
        images = DESIGN_IMAGES.get(style, DESIGN_IMAGES['modern']).copy()
        random.shuffle(images)

        return jsonify({
            "success": True,
            "style": style,
            "images": images,
            "count": len(images)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """
    Return AI design recommendations for a given style.
    Query param: ?style=modern
    Output: { recommendations: [...] }
    """
    try:
        style = request.args.get('style', 'modern').lower()

        if style not in RECOMMENDATIONS:
            return jsonify({"error": f"Unknown style: {style}"}), 400

        recs = RECOMMENDATIONS.get(style, [])

        return jsonify({
            "success": True,
            "style": style,
            "recommendations": recs
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/generate-setup', methods=['POST'])
def generate_setup():
    """
    Generate a real-world shopping setup based on the selected design style.
    Input: JSON { "style": "modern" }
    Output: { products: [...], total_cost: 0 }
    """
    try:
        data = request.get_json()
        style = data.get('style', 'modern').lower() if data else 'modern'

        if style not in PRODUCTS:
            return jsonify({"error": f"Unknown style: {style}"}), 400

        products = PRODUCTS.get(style, [])
        total_cost = sum(p['price'] for p in products)

        return jsonify({
            "success": True,
            "style": style,
            "products": products,
            "total_cost": total_cost,
            "currency": "INR"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/wall-colors', methods=['GET'])
def get_wall_colors():
    """Return preset wall color palettes."""
    palettes = {
        "modern": ["#F5F5F0", "#E8E8E3", "#2C2C2C", "#4A90D9", "#6B7280"],
        "minimal": ["#FAFAF8", "#F0EEE9", "#D4C5B0", "#A8A196", "#7C7269"],
        "traditional": ["#F4ECD8", "#DEB48C", "#8B4513", "#2F4F4F", "#800020"],
        "luxury": ["#1A1A2E", "#16213E", "#C9A96E", "#8B7355", "#2C1810"],
        "scandinavian": ["#FAFAF8", "#F5F0E8", "#E8DDD0", "#C4B8A8", "#8B7B6B"]
    }
    return jsonify({"palettes": palettes})


# ─────────────────────────────────────────────────────────────────────────────
# AI ROOM TRANSFORMATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

ROOM_PROMPTS = {
    "modern":        "modern minimalist {room_type}, clean furniture, neutral colors, soft ambient lighting, high quality interior design, 8k, photorealistic",
    "minimal":       "minimalist zen {room_type}, essential furniture only, white and natural wood palette, abundant natural light, serene atmosphere, photorealistic",
    "traditional":   "traditional classic {room_type}, ornate wooden furniture, rich jewel-tone fabrics, warm ambient lighting, elegant heritage design, photorealistic",
    "luxury":        "luxury opulent {room_type}, marble surfaces, gold accents, designer furniture, dramatic lighting, hotel-grade interior, 8k, photorealistic",
    "scandinavian":  "scandinavian {room_type}, light wood floors, white walls, hygge aesthetic, natural textiles, large windows with natural light, photorealistic",
}

FALLBACK_IMAGES = {
    "modern": [
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=85",
        "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=85",
        "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=85",
    ],
    "minimal": [
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85",
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=85",
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=85",
    ],
    "traditional": [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85",
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=85",
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=85",
    ],
    "luxury": [
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85",
        "https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=1200&q=85",
        "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1200&q=85",
    ],
    "scandinavian": [
        "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=85",
        "https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=1200&q=85",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85",
    ],
}


def compress_image(image_bytes, max_size=MAX_IMAGE_SIZE, quality=85):
    """Compress and resize image for API submission."""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert('RGB')
    img.thumbnail(max_size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=quality, optimize=True)
    buf.seek(0)
    return buf.getvalue()


def get_cache_key(image_bytes, style):
    """Generate a cache key from image content + style."""
    h = hashlib.sha256(image_bytes)
    h.update(style.encode())
    return h.hexdigest()


def build_prompt(style, room_type="room"):
    """Build the AI prompt for the given style."""
    template = ROOM_PROMPTS.get(style, ROOM_PROMPTS['modern'])
    return template.format(room_type=room_type)


def call_stability_api(image_bytes, prompt, style):
    """Call Stability AI Control Structure API to perfectly preserve layout."""
    if not STABILITY_API_KEY or not http_requests:
        print("Stability AI: No API key or requests library unavailable")
        return None

    print(f"Stability AI: Starting generation for style '{style}'...")

    headers = {
        "Authorization": f"Bearer {STABILITY_API_KEY}",
        "Accept": "application/json",
    }

    negative_prompt = (
        "blurry, distorted, low quality, deformed, ugly, cartoon, anime, "
        "illustration, painting, sketch, watermark, text"
    )

    try:
        # Use Stability's explicitly designed structural preservation API (like ControlNet)
        res = http_requests.post(
            "https://api.stability.ai/v2beta/stable-image/control/structure",
            headers=headers,
            files={
                "image": ("room.jpg", io.BytesIO(image_bytes), "image/jpeg"),
            },
            data={
                "prompt": f"{prompt}, high quality, highly detailed, photorealistic",
                "negative_prompt": negative_prompt,
                "control_strength": 0.75, # High value to strictly enforce the layout
                "output_format": "png",
            },
            timeout=40,
        )

        print(f"Stability AI: Response status {res.status_code}")

        if res.status_code == 200:
            data = res.json()
            # v2beta API returns base64 string directly under "image" key
            img_b64 = data.get("image")
            if not img_b64:
                print("Stability AI: No image in response")
                return None

            img_data = base64.b64decode(img_b64)
            filename = f"transform_{int(time.time())}_{random.randint(1000,9999)}.png"
            filepath = os.path.join(GENERATED_DIR, filename)
            with open(filepath, 'wb') as f:
                f.write(img_data)
            print(f"Stability AI: Saved generated image to {filename}")
            return f"/api/generated-images/{filename}"
        else:
            try:
                err = res.json()
                print(f"Stability AI error {res.status_code}: {err}")
            except Exception:
                print(f"Stability AI error {res.status_code}: {res.text[:300]}")
            return None

    except Exception as e:
        print(f"Stability AI error: {e}")
        return None


@app.route('/api/generated-images/<filename>')
def serve_generated_image(filename):
    """Serve AI-generated images from the generated directory."""
    return send_from_directory(GENERATED_DIR, filename)


@app.route('/api/generate-room', methods=['POST'])
def generate_room():
    """
    AI Room Transformation endpoint.
    Input: multipart/form-data with 'image' file and 'style' string.
    Output: { generated_image_url: "..." }

    Pipeline:
    1. Compress uploaded image
    2. Check cache for same image+style
    3. Build prompt
    4. Call Stability AI API (SDXL image-to-image)
    5. Fall back to curated images if API unavailable
    """
    try:
        style = request.form.get('style', 'modern').lower()
        valid_styles = list(ROOM_PROMPTS.keys())
        if style not in valid_styles:
            return jsonify({"error": f"Unknown style: {style}. Valid: {valid_styles}"}), 400

        image_file = request.files.get('image')
        if not image_file:
            return jsonify({"error": "No image uploaded"}), 400

        # Read and compress image
        raw_bytes = image_file.read()
        if len(raw_bytes) == 0:
            return jsonify({"error": "Empty image file"}), 400

        compressed = compress_image(raw_bytes)

        # Check cache
        cache_key = get_cache_key(compressed, style)
        cached = GENERATION_CACHE.get(cache_key)
        if cached and (time.time() - cached['timestamp'] < CACHE_TTL):
            return jsonify({
                "success": True,
                "generated_image_url": cached['url'],
                "style": style,
                "cached": True,
            })

        # Build prompt
        prompt = build_prompt(style)

        # Try Stability AI API
        result_url = call_stability_api(compressed, prompt, style)

        if result_url:
            # Cache the result
            GENERATION_CACHE[cache_key] = {'url': result_url, 'timestamp': time.time()}
            return jsonify({
                "success": True,
                "generated_image_url": result_url,
                "style": style,
                "prompt_used": prompt,
                "cached": False,
            })

        # Fallback: return curated design images
        fallback_list = FALLBACK_IMAGES.get(style, FALLBACK_IMAGES['modern'])
        fallback_url = random.choice(fallback_list)
        GENERATION_CACHE[cache_key] = {'url': fallback_url, 'timestamp': time.time()}

        return jsonify({
            "success": True,
            "generated_image_url": fallback_url,
            "style": style,
            "prompt_used": prompt,
            "fallback": True,
        })

    except Exception as e:
        print(f"generate-room error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("AI Interior Designer Backend starting on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
