#!/usr/bin/env python3
"""BozorNarx product & category illustrations. One consistent style: soft gradients, rim light, contact shadow.
Every component returns (defs, body) in local coordinates centred on (0,0); compositions place them on a 400x400 canvas."""
import math, os, random, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
_n = [0]
def uid(): _n[0] += 1; return f'i{_n[0]}'

def rg(i, stops, cx=.35, cy=.3, r=.8):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>' for o, c, a in [(x + (None,))[:3] if len(x) == 2 else x for x in stops])
    return f'<radialGradient id="{i}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>'
def lg(i, stops, x1=0, y1=0, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>' for o, c, a in [(x + (None,))[:3] if len(x) == 2 else x for x in stops])
    return f'<linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'
def hl(cx, cy, rx, ry, rot=0, op=.5): return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff" opacity="{op}" transform="rotate({rot} {cx} {cy})"/>'
def poly(pts, fill, extra=''): return '<polygon points="' + ' '.join(f'{x},{y}' for x, y in pts) + f'" fill="{fill}" {extra}/>'

# ---------------------------------------------------------------- components
def potato(shade=0):
    p = uid(); R = random.Random(11 + shade)
    d = rg(p, [(0, '#f6d896'), (.55, '#d8aa5e'), (1, '#a87a36')])
    P = 'M-95 10 C-110 -40 -60 -78 0 -80 C65 -82 108 -44 98 14 C90 62 42 84 -8 82 C-58 80 -88 50 -95 10Z'
    b = f'<path d="{P}" fill="url(#{p})"/>' + hl(-34, -40, 36, 13, -18, .32)
    for _ in range(26): b += f'<circle cx="{R.uniform(-80,80):.0f}" cy="{R.uniform(-55,60):.0f}" r="{R.uniform(1.2,2.6):.1f}" fill="#8a6226" opacity=".32"/>'
    for ex, ey in [(34, 8), (-46, 20), (6, -34), (-8, 50)]: b += f'<ellipse cx="{ex}" cy="{ey}" rx="6.5" ry="3.6" fill="#7a5522" opacity=".75"/><ellipse cx="{ex}" cy="{ey-1.5}" rx="5" ry="2" fill="#a97d3f" opacity=".6"/>'
    b += '<path d="M-60 60 C-20 84 50 80 84 40" fill="none" stroke="#8a6226" stroke-width="5" opacity=".18" stroke-linecap="round"/>'
    return d, b

def onion(red=False):
    p = uid(); a, m, c = ('#e9a9c9', '#b24d83', '#7a2559') if red else ('#f8d594', '#e0963a', '#b3611c')
    ln = '#5c1840' if red else '#8c4a12'
    d = rg(p, [(0, a), (.55, m), (1, c)], .38, .3, .85) + lg(p + 's', [(0, '#fbe9c8'), (1, '#e8c78a' if not red else '#e7b9d2')])
    b = f'<path d="M0 -92 C12 -60 95 -52 95 25 C95 85 52 112 0 112 C-52 112 -95 85 -95 25 C-95 -52 -12 -60 0 -92Z" fill="url(#{p})"/>'
    for k, dx in enumerate([-62, -34, -8, 20, 48, 72]): b += f'<path d="M{dx*.1:.0f} -86 C{dx*1.15:.0f} -30 {dx*1.25:.0f} 40 {dx*.55:.0f} 108" fill="none" stroke="{ln}" stroke-width="2.2" opacity=".26"/>'
    b += f'<path d="M-7 -86 C-5 -112 -2 -128 0 -142 C2 -128 5 -112 7 -86Z" fill="url(#{p}s)"/>' + hl(-44, -22, 18, 42, 18, .35)
    for k in range(9): b += f'<path d="M{-14+k*3.5:.1f} 110 q{(k-4)*2.2:.1f} 14 {(k-4)*3.5:.1f} 22" fill="none" stroke="#d9c7a4" stroke-width="1.5"/>'
    return d, b

def carrot():
    p = uid()
    d = lg(p, [(0, '#ffb967'), (.5, '#f58120'), (1, '#d2570c')], 0, 0, 1, 0) + lg(p + 'g', [(0, '#a3dc5c'), (1, '#3d9a2b')])
    b = ''.join(f'<path d="{x}" fill="url(#{p}g)"/>' for x in ['M0 4 C-8 -30 -34 -52 -48 -94 C-12 -82 8 -40 0 4Z', 'M0 4 C0 -40 -6 -72 4 -112 C16 -72 10 -36 0 4Z', 'M0 4 C8 -30 34 -52 48 -92 C12 -80 -8 -40 0 4Z'])
    b += f'<path d="M-30 8 C-30 -8 30 -8 30 8 C30 44 15 120 4 188 C2 196 -2 196 -4 188 C-15 120 -30 44 -30 8Z" fill="url(#{p})"/>'
    for y in [24, 48, 72, 98, 126, 154]:
        w = 28 * (1 - y / 200); b += f'<path d="M{-w+3:.1f} {y} q{w:.1f} 7 {2*w-6:.1f} 0" fill="none" stroke="#b8480a" stroke-width="2" opacity=".38"/>'
    b += '<path d="M-18 14 C-20 70 -8 130 -2 176" fill="none" stroke="#ffe0b0" stroke-width="6" opacity=".4" stroke-linecap="round"/>'
    return d, b

def tomato(small=False):
    p = uid()
    d = rg(p, [(0, '#ff9484'), (.5, '#e3382c'), (1, '#9d140d')], .36, .3, .82) + lg(p + 'g', [(0, '#8ed04e'), (1, '#3b8f27')])
    b = f'<ellipse cx="0" cy="0" rx="112" ry="98" fill="url(#{p})"/>'
    b += '<ellipse cx="34" cy="74" rx="52" ry="13" fill="#ff9a8a" opacity=".28"/>' + hl(-46, -44, 31, 16, -35, .5) + hl(-24, -62, 8, 4, -35, .75)
    b += '<ellipse cx="0" cy="-86" rx="30" ry="9" fill="#8e1710" opacity=".5"/>'
    pts = []
    for k in range(12):
        a = math.pi * 2 * k / 12 - math.pi / 2; r = 54 if k % 2 == 0 else 17
        pts.append((round(math.cos(a) * r, 1), round(math.sin(a) * r * .52, 1)))
    b += f'<g transform="translate(0 -86)">' + poly(pts, f'url(#{p}g)') + '<path d="M-6 0 C-6 -24 4 -28 9 -36" fill="none" stroke="#4d7a22" stroke-width="9" stroke-linecap="round"/></g>'
    return d, b

def cucumber():
    p = uid(); R = random.Random(5)
    d = lg(p, [(0, '#a4e06a'), (.5, '#58ac30'), (1, '#2b6f1a')])
    b = f'<path d="M-150 -30 C-100 -38 100 -38 150 -30 C174 -26 178 26 150 30 C100 38 -100 38 -150 30 C-178 26 -174 -26 -150 -30Z" fill="url(#{p})"/>'
    b += '<path d="M-140 -18 C-60 -27 80 -27 140 -18" fill="none" stroke="#d6f7ad" stroke-width="7" opacity=".5" stroke-linecap="round"/>'
    for yy in [-8, 6, 18]: b += f'<path d="M-146 {yy} C-60 {yy+4} 70 {yy+4} 146 {yy}" fill="none" stroke="#9bd66a" stroke-width="2" opacity=".5"/>'
    for _ in range(34): b += f'<ellipse cx="{R.uniform(-140,140):.0f}" cy="{R.uniform(-22,24):.0f}" rx="2.6" ry="1.7" fill="#1f5a12" opacity=".4"/>'
    b += '<ellipse cx="-160" cy="0" rx="8" ry="14" fill="#8fa83a"/>'
    return d, b

def cuc_slice():
    p = uid(); R = random.Random(8)
    d = rg(p, [(0, '#eaf8c4'), (1, '#c4e58a')], .5, .5, .6)
    b = '<circle r="46" fill="#2e7a1c"/><circle r="41" fill="#86c850"/>' + f'<circle r="35" fill="url(#{p})"/>'
    for k in range(10):
        a = math.pi * 2 * k / 10; b += f'<ellipse cx="{math.cos(a)*17:.1f}" cy="{math.sin(a)*17:.1f}" rx="6" ry="2.6" fill="#fffbd0" stroke="#d6e49a" stroke-width=".8" transform="rotate({k*36} {math.cos(a)*17:.1f} {math.sin(a)*17:.1f})"/>'
    b += '<circle r="6" fill="#cfe69b"/>' + hl(-18, -22, 12, 5, -40, .45)
    return d, b

def apple(green=False):
    p = uid(); a, m, c = ('#e4f57e', '#8fc232', '#4c8a17') if green else ('#ff7a63', '#d92b2b', '#8a1313')
    d = rg(p, [(0, a), (.55, m), (1, c)], .36, .3, .85) + rg(p + 'y', [(0, '#ffe36a', .0 if green else .6), (1, '#ffe36a', 0)], .5, .05, .6)
    P = 'M0 -62 C-30 -92 -95 -82 -100 0 C-104 70 -60 135 -20 130 C-8 128 -4 122 0 122 C4 122 8 128 20 130 C60 135 104 70 100 0 C95 -82 30 -92 0 -62Z'
    b = f'<path d="{P}" fill="url(#{p})"/><path d="{P}" fill="url(#{p}y)"/>'
    b += hl(-50, -26, 18, 36, 20, .42) + hl(-62, -58, 6, 3, 20, .7) + f'<ellipse cx="0" cy="-60" rx="22" ry="8" fill="{c}" opacity=".6"/>'
    b += '<path d="M0 -62 C-2 -86 6 -102 12 -112" fill="none" stroke="#6b4423" stroke-width="9" stroke-linecap="round"/>'
    b += '<path d="M12 -94 C32 -126 72 -122 86 -102 C62 -78 30 -80 12 -94Z" fill="#58a626"/><path d="M14 -94 C40 -104 64 -104 84 -102" fill="none" stroke="#9fd66a" stroke-width="2.5"/>'
    return d, b

def orange():
    p = uid(); R = random.Random(3)
    d = rg(p, [(0, '#ffc872'), (.5, '#f68c20'), (1, '#c55a08')], .36, .3, .85)
    b = f'<circle r="100" fill="url(#{p})"/>'
    for _ in range(90):
        a = R.uniform(0, 6.28); r = R.uniform(0, 96); b += f'<circle cx="{math.cos(a)*r:.0f}" cy="{math.sin(a)*r:.0f}" r="1.3" fill="#c25a08" opacity=".3"/>'
    b += hl(-42, -44, 28, 14, -35, .45) + '<path d="M0 -98 C-4 -112 4 -118 10 -122" stroke="#5c7a2a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M8 -108 C26 -130 56 -124 62 -112 C44 -96 22 -98 8 -108Z" fill="#5aa62a"/>'
    return d, b

def orange_slice():
    p = uid()
    d = rg(p, [(0, '#ffd89a'), (1, '#f7a23a')], .5, .5, .6)
    b = '<circle r="58" fill="#f08a1c"/><circle r="53" fill="#fff1d6"/>' + f'<circle r="48" fill="url(#{p})"/>'
    for k in range(10):
        a = 36 * k; b += f'<path d="M0 0 L{math.cos(math.radians(a-14))*44:.1f} {math.sin(math.radians(a-14))*44:.1f} A44 44 0 0 1 {math.cos(math.radians(a+14))*44:.1f} {math.sin(math.radians(a+14))*44:.1f}Z" fill="#fbb04a" opacity=".85" stroke="#fff1d6" stroke-width="1.5"/>'
    return d, b + '<circle r="4" fill="#fff1d6"/>'

def rosemary():
    b = '<path d="M-70 40 C-30 10 20 -20 80 -50" fill="none" stroke="#5a7a3a" stroke-width="3"/>'
    for k in range(14):
        t = k / 13; x = -70 + 150 * t; y = 40 - 90 * t + math.sin(t * 3) * 5
        b += f'<path d="M{x:.0f} {y:.0f} l-4 -16" stroke="#6e9a46" stroke-width="3" stroke-linecap="round"/><path d="M{x:.0f} {y:.0f} l5 14" stroke="#6e9a46" stroke-width="3" stroke-linecap="round"/>'
    return '', b

def steak():
    p = uid(); R = random.Random(9)
    d = rg(p, [(0, '#f0847a'), (.5, '#c93d3d'), (1, '#8d1f23')], .4, .3, .9)
    P = 'M-110 -10 C-116 -62 -50 -92 20 -86 C92 -80 124 -36 116 14 C108 66 56 90 -10 90 C-76 90 -106 48 -110 -10Z'
    b = f'<path d="{P}" fill="#f4dccb"/><path d="M-100 -8 C-104 -54 -46 -80 20 -75 C84 -70 112 -34 106 12 C98 58 52 80 -10 80 C-68 80 -96 42 -100 -8Z" fill="url(#{p})"/>'
    for _ in range(11):
        x = R.uniform(-80, 80); y = R.uniform(-55, 55); b += f'<path d="M{x:.0f} {y:.0f} c{R.uniform(10,30):.0f} {R.uniform(-14,14):.0f} {R.uniform(20,40):.0f} {R.uniform(-12,12):.0f} {R.uniform(30,56):.0f} {R.uniform(-8,8):.0f}" fill="none" stroke="#fde6dc" stroke-width="{R.uniform(1.5,4):.1f}" opacity=".7" stroke-linecap="round"/>'
    b += hl(-44, -42, 40, 11, -12, .3) + '<path d="M-108 0 C-112 -40 -70 -70 -20 -80" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>'
    return d, b

def drumstick():
    p = uid(); R = random.Random(21)
    d = rg(p, [(0, '#f9ca76'), (.5, '#dc8e2d'), (1, '#9b5016')], .38, .3, .9)
    b = '<path d="M26 44 L112 130" stroke="#d9c7a0" stroke-width="26" stroke-linecap="round"/><path d="M26 44 L112 130" stroke="#fff4dc" stroke-width="20" stroke-linecap="round"/>'
    b += '<circle cx="120" cy="116" r="15" fill="#fff4dc"/><circle cx="130" cy="136" r="15" fill="#fff4dc"/><circle cx="118" cy="114" r="6" fill="#fff" opacity=".7"/>'
    b += f'<path d="M-76 -24 C-66 -84 52 -96 92 -38 C116 0 92 72 30 84 C-22 94 -86 46 -76 -24Z" fill="url(#{p})"/>'
    for _ in range(34): b += f'<circle cx="{R.uniform(-60,80):.0f}" cy="{R.uniform(-60,66):.0f}" r="{R.uniform(1.4,3):.1f}" fill="#8a4210" opacity=".3"/>'
    b += hl(-34, -42, 34, 12, -24, .38)
    return d, b

def egg(brown=False):
    p = uid(); a, m, c = ('#f0c391', '#cf9254', '#a86a30') if brown else ('#fffaf0', '#f4e3c3', '#dcc08e')
    d = rg(p, [(0, a), (.6, m), (1, c)], .36, .3, .85)
    b = f'<path d="M0 -76 C40 -76 62 -24 62 22 C62 66 36 88 0 88 C-36 88 -62 66 -62 22 C-62 -24 -40 -76 0 -76Z" fill="url(#{p})"/>' + hl(-24, -34, 14, 30, 18, .5)
    return d, b

def milkbottle():
    p = uid(); P = 'M-48 -40 C-48 -72 -30 -80 -30 -122 L-30 -140 L30 -140 L30 -122 C30 -80 48 -72 48 -40 L48 100 C48 122 36 132 20 132 L-20 132 C-36 132 -48 122 -48 100Z'
    d = lg(p, [(0, '#ffffff'), (1, '#e3eef7')], 0, 0, 1, 0) + f'<clipPath id="{p}c"><path d="{P}"/></clipPath>' + lg(p + 'k', [(0, '#79b4ee'), (1, '#2a68b0')])
    b = f'<path d="{P}" fill="#e8f2fa" opacity=".9"/><g clip-path="url(#{p}c)"><rect x="-60" y="-70" width="120" height="210" fill="url(#{p})"/><rect x="-60" y="-70" width="120" height="8" fill="#d6e6f3"/></g><path d="{P}" fill="none" stroke="#b9d3e6" stroke-width="2.5"/>'
    b += f'<rect x="-35" y="-158" width="70" height="26" rx="6" fill="url(#{p}k)"/>' + ''.join(f'<line x1="{x}" y1="-154" x2="{x}" y2="-136" stroke="#fff" opacity=".35"/>' for x in range(-26, 30, 8))
    b += '<rect x="-42" y="2" width="84" height="76" rx="10" fill="#fff"/><rect x="-42" y="2" width="84" height="22" rx="10" fill="#3a78c2"/><rect x="-42" y="14" width="84" height="10" fill="#3a78c2"/>'
    b += '<text x="0" y="62" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="25" text-anchor="middle" fill="#2a68b0">SUT</text><path d="M0 -4 q-5 -8 0 -12 q5 4 0 12" fill="#fff"/>'
    b += '<rect x="-40" y="-60" width="7" height="170" rx="3.5" fill="#fff" opacity=".7"/>'
    return d, b

def milkglass():
    p = uid(); d = lg(p, [(0, '#ffffff'), (1, '#e6f0f8')])
    b = '<path d="M-40 -50 L40 -50 L32 70 C31 82 -31 82 -32 70Z" fill="#eaf3fa" stroke="#bcd6e8" stroke-width="2.5"/>'
    b += f'<path d="M-37 -30 L37 -30 L31 68 C30 78 -30 78 -31 68Z" fill="url(#{p})"/><ellipse cx="0" cy="-30" rx="37" ry="7" fill="#fff" stroke="#d3e4f0"/>' + '<rect x="-30" y="-40" width="5" height="90" rx="2.5" fill="#fff" opacity=".8"/>'
    return d, b

def cheese():
    p = uid()
    top, front, side = '#ffe58c', '#f6c84a', '#dfa627'
    b = poly([(-100, 0), (40, -50), (112, -8), (-30, 42)], top) + poly([(-100, 0), (-30, 42), (-30, 98), (-100, 56)], front) + poly([(-30, 42), (112, -8), (112, 48), (-30, 98)], side)
    for x, y, rx, ry, f in [(10, -4, 9, 5, '#e8b43a'), (60, -18, 7, 4, '#e8b43a'), (-62, 52, 9, 12, '#d9a62a'), (30, 70, 10, 13, '#c8921c'), (80, 20, 8, 11, '#c8921c'), (-10, 14, 6, 3.5, '#e8b43a')]:
        b += f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{f}"/>'
    return '', b

def flourbag():
    p = uid()
    P = 'M-95 -60 C-100 -20 -105 40 -100 100 C-98 128 -80 134 -60 132 C-20 136 20 136 60 132 C80 134 98 128 100 100 C105 40 100 -20 95 -60 C80 -92 52 -102 30 -116 C10 -106 -10 -106 -30 -116 C-52 -102 -80 -92 -95 -60Z'
    d = lg(p, [(0, '#f0dcb0'), (.55, '#dcb878'), (1, '#c29854')], 0, 0, 1, 0)
    b = f'<path d="{P}" fill="url(#{p})"/><path d="M-95 -60 C-80 -92 -52 -102 -30 -116 C-10 -106 10 -106 30 -116 C52 -102 80 -92 95 -60 C60 -74 -60 -74 -95 -60Z" fill="#c9a266"/>'
    b += '<rect x="-44" y="-102" width="88" height="14" rx="7" fill="#9a6a30"/><path d="M-30 -116 L-38 -134 L-14 -116 L-6 -138 L8 -116 L22 -136 L30 -116Z" fill="#d4b074"/>'
    b += '<rect x="-64" y="-34" width="128" height="112" rx="14" fill="#fffdf6"/><rect x="-64" y="-34" width="128" height="26" rx="14" fill="#8a5a1a"/><rect x="-64" y="-22" width="128" height="14" fill="#8a5a1a"/>'
    b += '<text x="0" y="-14" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" text-anchor="middle" fill="#fff4d8" letter-spacing="2">BUG‘DOY UNI</text><text x="0" y="48" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="42" text-anchor="middle" fill="#8a5a1a">UN</text><text x="0" y="68" font-family="Arial,Helvetica,sans-serif" font-size="12" text-anchor="middle" fill="#8a7a5a">oliy nav · 2 kg</text>'
    b += '<path d="M-100 100 C-98 128 -80 134 -60 132 L-100 130Z" fill="#000" opacity=".05"/><rect x="58" y="-56" width="42" height="190" rx="14" fill="#7a5420" opacity=".12"/>'
    b += '<ellipse cx="0" cy="140" rx="90" ry="11" fill="#fff" opacity=".9"/><circle cx="-60" cy="136" r="9" fill="#fff"/><circle cx="55" cy="137" r="7" fill="#fff"/>'
    return d, b

def wheat():
    b = '<path d="M0 130 C2 60 -2 0 0 -70" fill="none" stroke="#c9a23a" stroke-width="4" stroke-linecap="round"/>'
    for k in range(8):
        y = -66 + k * 16; b += f'<ellipse cx="-9" cy="{y}" rx="5.5" ry="12" fill="#ecc352" stroke="#c9a23a" stroke-width="1" transform="rotate(-24 -9 {y})"/><ellipse cx="9" cy="{y}" rx="5.5" ry="12" fill="#f3cf62" stroke="#c9a23a" stroke-width="1" transform="rotate(24 9 {y})"/>'
    b += '<ellipse cx="0" cy="-84" rx="5" ry="13" fill="#f3cf62" stroke="#c9a23a" stroke-width="1"/>'
    return '', b

def ricebag():
    p = uid(); R = random.Random(14)
    d = lg(p, [(0, '#ffffff'), (1, '#e9eef3')], 0, 0, 1, 0) + lg(p + 'g', [(0, '#3bb06a'), (1, '#1b7440')])
    b = f'<path d="M-82 -100 L82 -100 L88 -86 C96 -20 94 60 86 120 L-86 120 C-94 60 -96 -20 -88 -86Z" fill="url(#{p})" stroke="#cdd6df" stroke-width="2"/>'
    for _ in range(120): b += f'<ellipse cx="{R.uniform(-78,78):.0f}" cy="{R.uniform(58,112):.0f}" rx="5" ry="1.9" fill="#fffdf4" stroke="#e3dcc4" stroke-width=".4" transform="rotate({R.uniform(0,180):.0f} 0 0)" opacity=".85"/>'
    b += '<path d="M-82 -100 L82 -100 L82 -86 L-88 -86Z" fill="#d6dee8"/>' + ''.join(f'<line x1="{x}" y1="-100" x2="{x}" y2="-86" stroke="#bfc9d6"/>' for x in range(-76, 80, 6))
    b += f'<rect x="-60" y="-70" width="120" height="124" rx="14" fill="url(#{p}g)"/><text x="0" y="-26" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="23" text-anchor="middle" fill="#fff">GURUCH</text><text x="0" y="-8" font-family="Arial,Helvetica,sans-serif" font-size="11" text-anchor="middle" fill="#dff7e8" letter-spacing="1">LAZER · 1 KG</text>'
    b += '<ellipse cx="0" cy="22" rx="30" ry="18" fill="#fffdf4" opacity=".95"/><path d="M-14 28 q14 -22 28 0" fill="none" stroke="#2b9a5a" stroke-width="3"/><path d="M-10 18 q10 -10 20 0" fill="none" stroke="#2b9a5a" stroke-width="3"/>'
    b += '<rect x="-74" y="-90" width="8" height="200" rx="4" fill="#fff" opacity=".7"/>'
    return d, b

def ricepile(color='#fffdf4', edge='#e3dcc4', seed=2, n=190, w=120, h=46):
    R = random.Random(seed)
    b = f'<ellipse cx="0" cy="14" rx="{w}" ry="{h*.5}" fill="#000" opacity=".1"/><path d="M{-w} 12 C{-w*.7} {-h*1.7} {w*.7} {-h*1.7} {w} 12 C{w*.5} {h*.5} {-w*.5} {h*.5} {-w} 12Z" fill="{color}" opacity=".95"/>'
    for _ in range(n):
        x = R.uniform(-w * .9, w * .9); top = -h * 1.55 * (1 - (x / w) ** 2) ** .8 + 10; y = R.uniform(top, 16)
        b += f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="6" ry="2.3" fill="{color}" stroke="{edge}" stroke-width=".6" transform="rotate({R.uniform(-60,60):.0f} {x:.0f} {y:.0f})"/>'
    return '', b

def sunflower(r=50):
    p = uid(); d = rg(p, [(0, '#a8702c'), (1, '#5a3512')], .4, .4, .7) + lg(p + 'p', [(0, '#ffe066'), (1, '#f5a900')])
    b = ''
    for k in range(16): a = k * 22.5; b += f'<ellipse cx="0" cy="{-r*.78}" rx="{r*.17}" ry="{r*.34}" fill="url(#{p}p)" stroke="#e29a00" stroke-width="1" transform="rotate({a})"/>'
    b += f'<circle r="{r*.46}" fill="url(#{p})"/>'
    R = random.Random(6)
    for _ in range(26): a = R.uniform(0, 6.28); rr = R.uniform(0, r * .4); b += f'<circle cx="{math.cos(a)*rr:.1f}" cy="{math.sin(a)*rr:.1f}" r="1.6" fill="#2e1a08" opacity=".6"/>'
    return d, b

def oilbottle():
    p = uid(); P = 'M-42 -30 C-42 -62 -24 -70 -24 -104 L-24 -122 L24 -122 L24 -104 C24 -70 42 -62 42 -30 L42 116 C42 134 30 142 14 142 L-14 142 C-30 142 -42 134 -42 116Z'
    d = lg(p, [(0, '#fff09a'), (.5, '#f7c313'), (1, '#c98a00')], 0, 0, 1, 0) + lg(p + 'c', [(0, '#5fb34a'), (1, '#2d7a26')])
    sd, sb = sunflower(26)
    b = f'<path d="{P}" fill="url(#{p})" stroke="#e2a208" stroke-width="2"/><rect x="-28" y="-142" width="56" height="26" rx="6" fill="url(#{p}c)"/><rect x="-6" y="-152" width="12" height="12" rx="3" fill="#2d7a26"/>'
    b += '<rect x="-38" y="6" width="76" height="92" rx="10" fill="#fffaf0"/>' + f'<g transform="translate(0 40)">{sb}</g>' + '<text x="0" y="88" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="14" text-anchor="middle" fill="#8a5a00">YOG‘</text>'
    b += '<rect x="-36" y="-56" width="7" height="68" rx="3.5" fill="#fff" opacity=".55"/><path d="M26 -40 C34 -20 36 10 34 40" fill="none" stroke="#fff6c0" stroke-width="3" opacity=".5"/>'
    return d + sd, b

def sugarbag(orange=False):
    p = uid(); band = ('#f0891c', '#c4610a') if orange else ('#3a78c2', '#25579a')
    d = lg(p, [(0, '#ffffff'), (1, '#e9ecf0')], 0, 0, 1, 0) + lg(p + 'b', [(0, band[0]), (1, band[1])])
    b = f'<path d="M-70 -104 L70 -104 L80 120 L-80 120Z" fill="url(#{p})" stroke="#d3d8df" stroke-width="2"/><rect x="-70" y="-106" width="140" height="22" fill="#e4e8ee"/>' + ''.join(f'<line x1="{x}" y1="-106" x2="{x}" y2="-84" stroke="#c6ccd5"/>' for x in range(-64, 70, 6))
    b += f'<rect x="-76" y="-30" width="152" height="70" fill="url(#{p}b)"/><text x="0" y="14" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="21" text-anchor="middle" fill="#fff" letter-spacing=".5">SHAKAR</text><text x="0" y="62" font-family="Arial,Helvetica,sans-serif" font-size="12" text-anchor="middle" fill="#7a8696">qand · 1 kg</text>'
    b += '<rect x="-60" y="-96" width="7" height="206" rx="3.5" fill="#fff" opacity=".7"/>'
    return d, b

def cube():
    return '', poly([(0, -22), (24, -10), (0, 2), (-24, -10)], '#ffffff', 'stroke="#dfe5ec" stroke-width="1"') + poly([(-24, -10), (0, 2), (0, 30), (-24, 18)], '#e0e6ee') + poly([(0, 2), (24, -10), (24, 18), (0, 30)], '#c9d2de') + '<ellipse cx="-4" cy="-10" rx="8" ry="2.6" fill="#fff" opacity=".8"/>'

def bread():
    p = uid(); R = random.Random(17)
    d = rg(p, [(0, '#f8dc92'), (.6, '#e3a64d'), (1, '#b46c20')], .4, .35, .8)
    b = '<ellipse cx="0" cy="8" rx="148" ry="104" fill="#8a5018" opacity=".4"/>' + f'<ellipse cx="0" cy="0" rx="148" ry="104" fill="url(#{p})"/><ellipse cx="0" cy="0" rx="126" ry="84" fill="none" stroke="#c07a2a" stroke-width="3" opacity=".5"/>'
    for rr, n in [(34, 12), (66, 20), (98, 30)]:
        for k in range(n):
            a = 6.283 * k / n; b += f'<ellipse cx="{math.cos(a)*rr*1.1:.1f}" cy="{math.sin(a)*rr*.74:.1f}" rx="2.8" ry="1.8" fill="#9a5a14" opacity=".65"/>'
    b += '<ellipse cx="0" cy="0" rx="30" ry="20" fill="#e9b45a" stroke="#b46c20" stroke-width="2"/>' + ''.join(f'<path d="M0 0 L{math.cos(math.radians(a))*28:.1f} {math.sin(math.radians(a))*18:.1f}" stroke="#b46c20" stroke-width="1.5"/>' for a in range(0, 360, 45))
    for _ in range(60): a = R.uniform(0, 6.28); rr = R.uniform(.2, .95); b += f'<circle cx="{math.cos(a)*148*rr:.0f}" cy="{math.sin(a)*104*rr:.0f}" r="{R.uniform(4,10):.0f}" fill="#8a4c10" opacity=".13"/>'
    for _ in range(30): a = R.uniform(0, 6.28); rr = R.uniform(.15, .9); x = math.cos(a) * 148 * rr; y = math.sin(a) * 104 * rr; b += f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="3.2" ry="1.6" fill="#fff3d0" transform="rotate({R.uniform(0,180):.0f} {x:.0f} {y:.0f})"/>'
    b += hl(-70, -50, 46, 12, -18, .3)
    return d, b

def bowl(grain='#8b5a2b', edge='#5e3a18', seed=1):
    p = uid(); d = lg(p, [(0, '#d99a62'), (1, '#8a4f2a')])
    _, g = ricepile(grain, edge, seed, 130, 88, 40)
    b = f'<path d="M-100 -6 L100 -6 C100 62 54 104 0 104 C-54 104 -100 62 -100 -6Z" fill="url(#{p})"/><ellipse cx="0" cy="-6" rx="100" ry="20" fill="#5a3216"/><g transform="translate(0 -22) scale(1 1)">{g}</g>'
    b += '<path d="M-94 4 C-90 50 -50 94 -10 100" fill="none" stroke="#fff" stroke-width="5" opacity=".25" stroke-linecap="round"/>'
    return d, b

def waterbottle():
    p = uid(); P = 'M-40 -40 C-40 -70 -22 -78 -22 -112 L-22 -128 L22 -128 L22 -112 C22 -78 40 -70 40 -40 L40 112 C40 130 30 138 14 138 L-14 138 C-30 138 -40 130 -40 112Z'
    d = lg(p, [(0, '#f1fbff'), (.5, '#bfe5fa'), (1, '#7cc2ee')], 0, 0, 1, 0) + lg(p + 'c', [(0, '#4ea0e0'), (1, '#2268b0')])
    b = f'<path d="{P}" fill="url(#{p})" stroke="#9fd2f0" stroke-width="2"/><rect x="-26" y="-148" width="52" height="24" rx="6" fill="url(#{p}c)"/>'
    b += '<path d="M-40 10 C-20 0 20 20 40 8 L40 70 C20 82 -20 62 -40 74Z" fill="#2f8bd6" opacity=".85"/><text x="0" y="48" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="16" text-anchor="middle" fill="#fff">SUV</text>'
    b += '<rect x="-34" y="-60" width="6" height="150" rx="3" fill="#fff" opacity=".7"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity=".7"/>' for x, y, r in [(18, -20, 4), (24, 96, 3), (-10, 104, 5)])
    return d, b

def juice():
    p = uid(); d = lg(p, [(0, '#ffc15a'), (1, '#f58a1c')])
    od, ob = orange_slice()
    b = '<path d="M-44 -70 L44 -70 L36 90 C35 102 -35 102 -36 90Z" fill="#f4fbff" stroke="#c6e3f2" stroke-width="2.5"/>' + f'<path d="M-41 -34 L41 -34 L35 88 C34 98 -34 98 -35 88Z" fill="url(#{p})"/><ellipse cx="0" cy="-34" rx="41" ry="7" fill="#ffd88a"/>' + '<rect x="-34" y="-56" width="6" height="120" rx="3" fill="#fff" opacity=".7"/>'
    b += '<path d="M14 -34 L40 -120" stroke="#e9453b" stroke-width="7" stroke-linecap="round"/>' + f'<g transform="translate(40 -62) scale(.62)">{ob}</g>'
    return d + od, b

def teacup():
    p = uid(); d = lg(p, [(0, '#ffffff'), (1, '#e6ecef')]) + lg(p + 't', [(0, '#d9893a'), (1, '#9a4f14')])
    b = '<ellipse cx="0" cy="62" rx="96" ry="16" fill="#e8eef0" stroke="#d3dde1"/>' + f'<path d="M-72 -20 L72 -20 C72 40 44 72 0 72 C-44 72 -72 40 -72 -20Z" fill="url(#{p})" stroke="#d3dde1" stroke-width="2"/>'
    b += '<path d="M70 -4 C106 -8 104 40 62 36" fill="none" stroke="#d3dde1" stroke-width="9" stroke-linecap="round"/><ellipse cx="0" cy="-20" rx="72" ry="14" fill="#f4f7f8" stroke="#d3dde1"/>' + f'<ellipse cx="0" cy="-19" rx="64" ry="11" fill="url(#{p}t)"/>'
    b += '<path d="M-60 6 C-30 24 30 24 60 6" fill="none" stroke="#3a9a52" stroke-width="5" opacity=".8"/>' + ''.join(f'<path d="M{x} -40 C{x-10} -62 {x+10} -78 {x} -100" fill="none" stroke="#c7d3d8" stroke-width="5" stroke-linecap="round" opacity=".7"/>' for x in (-20, 6, 30))
    return d, b

def spray():
    p = uid(); d = lg(p, [(0, '#8ad4f4'), (.5, '#3aa7e0'), (1, '#1f77b5')], 0, 0, 1, 0)
    b = f'<path d="M-44 -30 C-44 -50 -30 -56 -30 -70 L30 -70 C30 -56 44 -50 44 -30 L44 118 C44 134 32 140 20 140 L-20 140 C-32 140 -44 134 -44 118Z" fill="url(#{p})"/>'
    b += '<path d="M-30 -70 L-30 -96 C-30 -108 -10 -112 10 -112 L52 -112 L52 -96 L24 -92 L24 -70Z" fill="#fff" stroke="#d6dde3" stroke-width="2"/><rect x="-30" y="-82" width="54" height="14" fill="#2b9a52"/><path d="M52 -112 L70 -118 L70 -98 L52 -96Z" fill="#e9eef2"/>'
    b += '<rect x="-38" y="-6" width="76" height="84" rx="10" fill="#fff"/><path d="M-38 30 C-14 14 14 46 38 30 L38 70 C14 86 -14 54 -38 70Z" fill="#2b9a52" opacity=".85"/><text x="0" y="22" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="14" text-anchor="middle" fill="#1f77b5">TOZA</text>'
    b += '<rect x="-38" y="-46" width="6" height="150" rx="3" fill="#fff" opacity=".6"/>'
    return d, b

def soap():
    p = uid(); R = random.Random(4); d = lg(p, [(0, '#bfe9ff'), (1, '#6cbbe9')]) + lg(p + 'g', [(0, '#c4f0c0'), (1, '#6cc872')])
    b = f'<rect x="-76" y="-34" width="104" height="58" rx="16" fill="url(#{p})" transform="rotate(-10)"/><rect x="-6" y="14" width="104" height="58" rx="16" fill="url(#{p}g)" transform="rotate(8)"/>' + hl(-46, -34, 26, 6, -10, .6)
    for _ in range(9): b += f'<circle cx="{R.uniform(-80,100):.0f}" cy="{R.uniform(-80,40):.0f}" r="{R.uniform(6,18):.0f}" fill="#fff" opacity=".35" stroke="#bfe5fa" stroke-width="1.5"/>'
    return d, b

def jars():
    b = ''; d = ''
    for x, col, lab in [(-96, '#d9361f', 'PAPRIKA'), (0, '#f2b01e', 'ZIRA'), (96, '#4fa43a', 'BAZILIK')]:
        p = uid(); d += lg(p, [(0, '#ffffff', .9), (1, '#dfe9ef', .9)], 0, 0, 1, 0)
        b += f'<g transform="translate({x} 0)"><rect x="-38" y="-70" width="76" height="150" rx="14" fill="url(#{p})" stroke="#c9d8e0" stroke-width="2"/><rect x="-33" y="-20" width="66" height="96" rx="10" fill="{col}"/><rect x="-42" y="-92" width="84" height="26" rx="7" fill="#8a5a30"/><rect x="-30" y="2" width="60" height="38" rx="6" fill="#fff"/><text x="0" y="26" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="11" text-anchor="middle" fill="#3a3a3a">{lab}</text><rect x="-32" y="-60" width="5" height="120" rx="2.5" fill="#fff" opacity=".6"/></g>'
    return d, b

def shopbag():
    p = uid(); d = lg(p, [(0, '#fff7e4'), (1, '#e9d6a6')]) + lg(p + 'g', [(0, '#1f8a5a'), (1, '#0d5c3a')])
    sd, sb = sunflower(1)
    b = f'<path d="M-90 -40 L90 -40 L100 130 L-100 130Z" fill="url(#{p})" stroke="#d9c690" stroke-width="2"/><path d="M-50 -40 C-50 -110 50 -110 50 -40" fill="none" stroke="#9a7a3a" stroke-width="9" stroke-linecap="round"/>'
    b += f'<rect x="-60" y="10" width="120" height="86" rx="12" fill="url(#{p}g)"/>'
    b += '<path d="M-18 70 C-30 40 -4 22 22 28 C24 54 6 74 -18 70Z" fill="#8ed04e"/><path d="M-14 66 C-4 52 6 42 18 34" stroke="#d8f2a8" stroke-width="2.5" fill="none"/><text x="0" y="88" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="13" text-anchor="middle" fill="#fff">BozorNarx</text>'
    return d, b

# ---------------------------------------------------------------- composition
def place(c, x, y, s=1.0, rot=0, flip=False):
    d, b = c
    fl = f' scale({-s if flip else s} {s})'
    return d, f'<g transform="translate({x} {y}) rotate({rot}){fl}">{b}</g>'

def shadow(x=200, y=352, rx=128, ry=13, op=.17):
    i = uid()
    return f'<filter id="{i}" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>', f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#1f2d1f" opacity="{op}" filter="url(#{i})"/>'

def svg(parts, bg=None):
    defs = ''.join(d for d, _ in parts); body = ''.join(b for _, b in parts)
    bgs = f'<rect width="400" height="400" rx="0" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img"><defs>{defs}</defs>{bgs}{body}</svg>\n'

ART = {}
ART['kartoshka'] = [shadow(), place(potato(1), 128, 242, .66, -14), place(potato(2), 280, 238, .6, 16), place(potato(0), 205, 270, .94, -3)]
ART['piyoz'] = [shadow(), place(onion(), 122, 262, .56, -6), place(onion(True), 285, 268, .62, 8), place(onion(), 205, 232, 1.0)]
ART['sabzi'] = [shadow(rx=110), place(carrot(), 122, 168, .9, 24), place(carrot(), 288, 166, .88, -24), place(carrot(), 204, 146, 1.06, 0)]
ART['pomidor'] = [shadow(), place(tomato(), 112, 232, .68, -8), place(tomato(), 292, 238, .62, 10), place(tomato(), 200, 248, 1.0)]
ART['bodring'] = [shadow(), place(cucumber(), 205, 190, .88, -16), place(cuc_slice(), 126, 292, .82), place(cuc_slice(), 244, 304, .74), place(cuc_slice(), 322, 278, .6)]
ART['olma'] = [shadow(), place(apple(True), 276, 220, .8, 8), place(apple(), 172, 238, 1.02, -4)]
ART['mol-goshti'] = [shadow(rx=140), place(rosemary(), 292, 160, 1.0, 0), place(steak(), 190, 235, 1.0, -4), place(steak(), 304, 296, .5, 12)]
ART['tovuq-goshti'] = [shadow(), place(drumstick(), 132, 200, .94, -4, True), place(drumstick(), 250, 212, .98, 8)]
ART['tuxum'] = [shadow(), place(egg(), 140, 222, .86, -12), place(egg(True), 268, 226, .86, 12), place(egg(), 204, 270, 1.0)]
ART['sut'] = [shadow(), place(milkglass(), 292, 268, .78, 6), place(milkbottle(), 160, 214, 1.0, -2)]
ART['un'] = [shadow(), place(wheat(), 76, 250, .9, -22), place(wheat(), 330, 246, .84, 20), place(flourbag(), 204, 214, .96)]
ART['guruch'] = [shadow(), place(ricebag(), 168, 218, 1.0, -3), place(ricepile(), 290, 318, .9)]
ART['yog'] = [shadow(), place(oilbottle(), 160, 206, 1.0), place(sunflower(56), 300, 278, 1.0, 12), place(sunflower(34), 330, 180, 1.0, -10)]
ART['shakar'] = [shadow(), place(sugarbag(), 150, 216, 1.0, -4), place(sugarbag(True), 262, 228, .84, 7), place(cube(), 330, 326, 1.2), place(cube(), 294, 340, 1.0), place(cube(), 356, 342, .9)]
ART['non'] = [shadow(rx=150), place(bread(), 150, 200, .78, -6), place(bread(), 238, 250, 1.0, 4)]
ART['default'] = [shadow(), place(shopbag(), 200, 212, 1.12)]
# categories (use different hero compositions, same components)
CAT = {}
CAT['sabzavotlar'] = [shadow(rx=140), place(carrot(), 298, 158, .76, -26), place(potato(1), 100, 270, .6, -10), place(cucumber(), 228, 304, .46, -6), place(tomato(), 150, 215, .72), place(tomato(), 268, 238, .56, 8)]
CAT['mevalar'] = [shadow(rx=140), place(apple(True), 290, 238, .66, 10), place(orange(), 112, 250, .66), place(apple(), 202, 248, .9), place(orange_slice(), 322, 316, .5)]
CAT['gosht-va-parranda'] = [shadow(rx=140), place(steak(), 178, 200, .86, -6), place(drumstick(), 296, 270, .7, 8), place(egg(), 94, 298, .5), place(egg(True), 140, 316, .46)]
CAT['sut-mahsulotlari'] = [shadow(), place(milkbottle(), 150, 210, .9), place(cheese(), 300, 270, .9), place(milkglass(), 256, 168, .5, 6)]
CAT['non-va-un'] = [shadow(rx=150), place(flourbag(), 112, 216, .7), place(bread(), 262, 250, .86, 4), place(wheat(), 354, 210, .6, 16)]
CAT['don-va-yormalar'] = [shadow(rx=150), place(ricebag(), 106, 196, .78, -4), place(bowl('#8b5a2b', '#5e3a18', 3), 270, 214, .7), place(bowl('#e07b2a', '#a8501a', 7), 292, 316, .5)]
CAT['yog-va-ziravorlar'] = [shadow(rx=150), place(oilbottle(), 108, 210, .78), place(jars(), 264, 258, .62)]
CAT['ichimliklar'] = [shadow(), place(waterbottle(), 100, 208, .8), place(juice(), 214, 262, .85), place(teacup(), 306, 284, .62)]
CAT['uy-rozgor'] = [shadow(), place(spray(), 118, 216, .82), place(soap(), 270, 252, .9), place(shopbag(), 330, 290, .4)]
CAT['default'] = ART['default']

if __name__ == '__main__':
    os.makedirs(f'{OUT}/products', exist_ok=True); os.makedirs(f'{OUT}/categories', exist_ok=True)
    for k, v in ART.items(): open(f'{OUT}/products/{k}.svg', 'w', encoding='utf-8').write(svg(v))
    for k, v in CAT.items(): open(f'{OUT}/categories/{k}.svg', 'w', encoding='utf-8').write(svg(v))
    print(len(ART), 'products,', len(CAT), 'categories')
