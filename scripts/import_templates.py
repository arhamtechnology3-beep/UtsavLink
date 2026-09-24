#!/usr/bin/env python3
import urllib.request
import os
import re
import base64
import json
import shutil
from urllib.parse import urljoin, urlparse

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
T_DIR = os.path.join(BASE_DIR, 't')
MUSIC_DIR = os.path.join(BASE_DIR, 'media', 'music')

os.makedirs(T_DIR, exist_ok=True)
os.makedirs(MUSIC_DIR, exist_ok=True)

TEMPLATES = [
    {
        'slug': 'lanterns',
        'url': 'https://theluxuryinvites.com/demo/lanterns/',
        'title': 'Luxury Royal Lantern',
        'subtitle': 'The Luxury Invites · Royal Lanterns',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/lanterns.mp3'
    },
    {
        'slug': 'grandreveal',
        'url': 'https://theluxuryinvites.com/demo/shubham-vasundhara/',
        'title': 'The Grand Reveal',
        'subtitle': 'The Luxury Invites · Luxury Theatre Reveal',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/grandreveal.mp3'
    },
    {
        'slug': 'bloom',
        'url': 'https://theluxuryinvites.com/demo/kashish-rahul/',
        'title': 'The Auspicious Bloom',
        'subtitle': 'The Luxury Invites · Floral Reveal',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/bloom.mp3'
    },
    {
        'slug': 'sultanemerald',
        'url': 'https://theluxuryinvites.com/demo/sultanemerald/',
        'title': 'The Golden Gateway',
        'subtitle': 'The Luxury Invites · Sultan Emerald Suite',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/sultanemerald.mp3'
    },
    {
        'slug': 'jaipur',
        'url': 'https://theluxuryinvites.com/demo/jaipur-style/',
        'title': 'The Royal Archway',
        'subtitle': 'The Luxury Invites · Jaipur Royal Palace',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/default.mp3'
    },
    {
        'slug': 'royalmaharashtrian',
        'url': 'https://theluxuryinvites.com/demo/royalmaharashtrian/',
        'title': 'The Eternal Chronicle',
        'subtitle': 'The Luxury Invites · Royal Maharashtrian Vivah',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/royalmaharashtrian.mp3'
    },
    {
        'slug': 'cathedral',
        'url': 'https://theluxuryinvites.com/demo/cathedral-crown/victoriaalexander.html',
        'title': 'The Cathedral Crown',
        'subtitle': 'The Luxury Invites · Heritage Cathedral',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/cathedral.mp3'
    },
    {
        'slug': 'voyage',
        'url': 'https://theluxuryinvites.com/demo/kavyavishu/kavyavishu.html',
        'title': 'The Classic Voyage',
        'subtitle': 'The Luxury Invites · Vintage Luxury Journey',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/voyage.mp3'
    },
    {
        'slug': 'luminous',
        'url': 'https://theluxuryinvites.com/demo/rahul/',
        'title': 'The Luminous Horizon',
        'subtitle': 'The Luxury Invites · Luminous Celebration',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/luminous.mp3'
    },
    {
        'slug': 'heritage',
        'url': 'https://theluxuryinvites.com/demo/ibrahim-amina/',
        'title': 'The Sterling Heritage',
        'subtitle': 'The Luxury Invites · Aristocratic Wedding Suite',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/heritage.mp3'
    },
    {
        'slug': 'seaside',
        'url': 'https://theluxuryinvites.com/demo/seaside/beachtheme.html',
        'title': 'The Seaside Sacrament',
        'subtitle': 'The Luxury Invites · Oceanfront Wedding Journey',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/seaside.mp3'
    },
    {
        'slug': 'promise',
        'url': 'https://theluxuryinvites.com/demo/sterlin-promise/emilynoah.html',
        'title': 'The Sterling Promise',
        'subtitle': 'The Luxury Invites · Western Heirloom',
        'credit': 'theluxuryinvites.com',
        'audio_file': '/media/music/promise.mp3'
    }
]

def fetch_url(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()

def download_relative_assets(html, base_url, template_dir):
    # Regex for relative URLs in src, href, url()
    pattern = re.compile(r'(?:src|href|url)\s*[\(=]\s*[\"\']?([^\"\'\)\s>]+)[\"\']?', re.I)
    matches = pattern.findall(html)
    
    for rel_path in set(matches):
        if rel_path.startswith(('http://', 'https://', 'data:', '//', '#', 'javascript:', 'mailto:')):
            continue
        # Only media, images, video, font files
        ext = os.path.splitext(rel_path.split('?')[0].split('#')[0])[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp4', '.mp3', '.mpeg', '.wav', '.woff', '.woff2', '.ttf']:
            continue
            
        full_asset_url = urljoin(base_url, rel_path)
        clean_rel = rel_path.split('?')[0].split('#')[0].lstrip('/')
        local_dest = os.path.join(template_dir, clean_rel)
        os.makedirs(os.path.dirname(local_dest), exist_ok=True)
        
        if not os.path.exists(local_dest):
            try:
                print(f'    Downloading asset: {clean_rel} from {full_asset_url}')
                data = fetch_url(full_asset_url)
                with open(local_dest, 'wb') as f:
                    f.write(data)
            except Exception as e:
                print(f'    Warning downloading {full_asset_url}: {e}')

def process_template(tmpl):
    slug = tmpl['slug']
    url = tmpl['url']
    target_dir = os.path.join(T_DIR, slug)
    os.makedirs(target_dir, exist_ok=True)
    
    print(f'Processing {slug} ({url})...')
    raw_html = fetch_url(url).decode('utf-8', errors='ignore')
    
    # Download relative assets
    download_relative_assets(raw_html, url, target_dir)
    
    cleaned_html = raw_html
    
    # Remove cloudflare insights beacon
    cleaned_html = re.sub(r'<script[^>]*static\.cloudflareinsights\.com[^>]*>.*?</script>', '', cleaned_html, flags=re.DOTALL | re.I)
    
    audio_path = tmpl['audio_file']
    
    # Normalize audio src in HTML
    # 1. Replace existing <audio> tags or <source> tags
    if '<audio' in cleaned_html:
        # If <source> exists inside <audio>, replace source src
        if '<source' in cleaned_html:
            cleaned_html = re.sub(
                r'(<source[^>]*src=)[\"\'][^\"\']+[\"\']',
                rf'\1"{audio_path}"',
                cleaned_html,
                count=1,
                flags=re.I
            )
        # If audio tag has src attribute, replace it
        cleaned_html = re.sub(
            r'(<audio[^>]*src=)[\"\'][^\"\']+[\"\']',
            rf'\1"{audio_path}"',
            cleaned_html,
            count=1,
            flags=re.I
        )
        # If audio tag has no src and no source (or base64 data URI in script)
        cleaned_html = re.sub(
            r'src=[\"\']data:audio/[^;]+;base64,[A-Za-z0-9+/=]+[\"\']',
            f'src="{audio_path}"',
            cleaned_html
        )
        # Replace relative audio sources in JS
        cleaned_html = re.sub(
            r'src\s*=\s*[\"\'](?:music\.(?:mpeg|mp3|wav|m4a)|[^\"\']*\.mp3)[\"\']',
            f'src="{audio_path}"',
            cleaned_html
        )
        # Replace audio.src = ... in JS
        cleaned_html = re.sub(
            r'audio\.src\s*=\s*[\"\'][^\"\']+[\"\']',
            f'audio.src = "{audio_path}"',
            cleaned_html
        )
    else:
        # If no audio tag (like jaipur), inject a background audio and floating button
        audio_widget = f'''
  <!-- Background Music Widget -->
  <audio id="bgMusic" loop preload="auto" src="{audio_path}"></audio>
  <button id="musicToggleBtn" type="button" aria-label="Toggle Music"
    style="position:fixed;bottom:24px;right:24px;width:50px;height:50px;border-radius:50%;background:#c5a059;border:2px solid #fff;color:#000;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);z-index:9999;cursor:pointer;transition:transform 0.3s ease;">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  </button>
  <script>
    (function() {{
      var a = document.getElementById("bgMusic");
      var btn = document.getElementById("musicToggleBtn");
      var playing = false;
      function toggle() {{
        if (playing) {{
          a.pause();
          btn.style.opacity = "0.7";
          btn.style.transform = "scale(0.95)";
        }} else {{
          a.play().then(function() {{
            btn.style.opacity = "1";
            btn.style.transform = "scale(1.05)";
          }}).catch(function(e) {{}});
        }}
        playing = !playing;
      }}
      if (btn) btn.addEventListener("click", toggle);
      document.addEventListener("click", function startOnce() {{
        if (!playing) toggle();
        document.removeEventListener("click", startOnce);
      }}, {{ once: true }});
    }})();
  </script>
'''
        cleaned_html = cleaned_html.replace('</body>', audio_widget + '\n</body>')
    
    out_html_path = os.path.join(target_dir, 'index.html')
    with open(out_html_path, 'w', encoding='utf-8') as f:
        f.write(cleaned_html)
    print(f'  Saved {out_html_path} ({len(cleaned_html)} bytes)')

def update_tracks_json():
    tracks_file = os.path.join(MUSIC_DIR, 'tracks.json')
    try:
        with open(tracks_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = {'tracks': []}
    
    existing_ids = {t['id']: t for t in data.get('tracks', [])}
    
    for tmpl in TEMPLATES:
        slug = tmpl['slug']
        audio_file = tmpl['audio_file']
        full_local = os.path.join(BASE_DIR, audio_file.lstrip('/'))
        size = os.path.getsize(full_local) if os.path.exists(full_local) else 0
        
        track_info = {
            'id': slug,
            'title': tmpl['title'],
            'subtitle': tmpl['subtitle'],
            'credit': tmpl['credit'],
            'file': audio_file,
            'bytes': size
        }
        existing_ids[slug] = track_info
        
    data['tracks'] = list(existing_ids.values())
    with open(tracks_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f'Updated tracks.json with {len(data["tracks"])} tracks.')

def main():
    print('Starting template import...')
    # Ensure promise.mp3 exists
    promise_audio = os.path.join(MUSIC_DIR, 'promise.mp3')
    celestial_audio = os.path.join(MUSIC_DIR, 'celestial.mp3')
    if not os.path.exists(promise_audio) and os.path.exists(celestial_audio):
        shutil.copyfile(celestial_audio, promise_audio)
        print('Copied celestial.mp3 -> promise.mp3')
        
    for tmpl in TEMPLATES:
        try:
            process_template(tmpl)
        except Exception as e:
            print(f'Error processing {tmpl["slug"]}: {e}')
            
    update_tracks_json()
    print('Template import complete!')

if __name__ == '__main__':
    main()
