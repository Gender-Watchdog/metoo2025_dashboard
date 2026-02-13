import requests
from bs4 import BeautifulSoup
import json
import re
import os
import csv
from datetime import datetime
import time
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('views_counter')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

MASTER_DB_FILE = 'sources/university_data_master.csv'
JSON_OUTPUT_FILE = 'js/university_data.json'

def extract_view_data(html_content):
    """Extract view count and other metrics from DC Inside HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Check for deletion/redirection first
    if soup.find('div', class_='box_infoview delete') or "sh_list_title" in str(soup):
         return None # Signals deleted

    view_count = 0
    view_count_span = soup.find('span', class_='gall_count')
    if view_count_span:
        count_text = view_count_span.text.strip()
        count_match = re.search(r'조회\s+(\d+)', count_text)
        if count_match:
            view_count = int(count_match.group(1))

    rec_count = 0
    rec_span = soup.find('span', class_='gall_reply_num')
    if rec_span:
        rec_text = rec_span.text.strip()
        rec_match = re.search(r'추천\s+(\d+)', rec_text)
        if rec_match:
            rec_count = int(rec_match.group(1))
            
    comment_count = 0
    comment_span = soup.find('span', class_='gall_comment')
    if comment_span:
         # Format often "comments X"
         c_text = comment_span.text.strip()
         c_match = re.search(r'(\d+)', c_text)
         if c_match:
             comment_count = int(c_match.group(1))
             
    post_date = ""
    date_span = soup.find('span', class_='gall_date')
    if date_span:
        post_date = date_span.text.strip()
        # Clean up date format if needed
        
    return {
        'views': view_count,
        'recs': rec_count,
        'comments': comment_count,
        'post_date': post_date
    }

def update_counts():
    if not os.path.exists(MASTER_DB_FILE):
        logger.error(f"Master DB not found: {MASTER_DB_FILE}")
        return

    # Load Initial Counts from Source
    initial_counts = {}
    try:
        with open('sources/dc_inside_post_urls.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                val = 0
                try:
                    val = int(row.get('initial_count', 0))
                except:
                    pass
                initial_counts[row['english_name']] = val
    except Exception as e:
        logger.warning(f"Could not load initial counts: {e}")

    updated_rows = []
    json_data = {}
    
    # Read Master DB
    with open(MASTER_DB_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            post_name = row['english_name']
            url = row['url']
            
            # Historic Data
            try:
                max_views = int(row.get('max_views', 0))
                current_views = int(row.get('current_views', 0))
            except:
                max_views = 0
                current_views = 0
            
            old_status = row.get('status', 'Active')
            removed_date = row.get('removed_date', '')

            # Scrape
            logger.info(f"Checking {post_name}...")
            
            new_status = old_status
            scrape_success = False
            
            try:
                response = requests.get(url, headers=HEADERS, timeout=10)
                
                # Check for redirects to list (soft delete)
                if 'board/lists' in response.url and 'view' not in response.url:
                    logger.info(f"  -> Redirected to list (Deleted)")
                    new_status = "Removed"
                    current_views = 0 # Reset current for removed
                
                elif response.status_code == 200:
                    data = extract_view_data(response.text)
                    
                    if data:
                        # Success
                        scrape_success = True
                        views = data['views']
                        
                        # Logic: If views drop to 0, it's weird, but usually implies deletion or error
                        # But if we got data, we trust it.
                        
                        current_views = views
                        if views > max_views:
                            max_views = views
                        
                        # Use other metrics
                        recs = data['recs']
                        comments = data['comments']
                        post_date = data['post_date']
                        
                        new_status = "Active"
                        
                        # Update JSON object
                        json_data[post_name] = {
                            "name_en": post_name,
                            "name_kr": row['korean_name'],
                            "current_views": current_views,
                            "max_views": max_views,
                            "initial_views": initial_counts.get(post_name, 0),
                            "status": new_status,
                            "post_date": post_date,
                            "recs": recs,
                            "comments": comments,
                            "url": url,
                            "removed_date": ""
                        }
                    else:
                        # Valid HTTP but content check failed (Deleted box)
                        logger.info(f"  -> Content missing (Deleted)")
                        new_status = "Removed"
                        current_views = 0
                else:
                     logger.warning(f"  -> HTTP {response.status_code}")
                     # Should we mark removed on ANY error? Maybe be conservative.
                     # If it was Active, maybe transient error?
                     # IF 404, yes removed.
                     if response.status_code == 404:
                         new_status = "Removed"
                         current_views = 0

            except Exception as e:
                logger.error(f"  -> Error: {e}")
            
            # Post-Scrape Logic
            if new_status == "Removed":
                if old_status == "Active":
                    # First time noticed removal
                    removed_date = datetime.now().strftime('%Y-%m-%d')
                
                # For removed posts, output specific JSON structure
                json_data[post_name] = {
                            "name_en": post_name,
                            "name_kr": row['korean_name'],
                            "current_views": 0,
                            "max_views": max_views,
                            "initial_views": initial_counts.get(post_name, 0),
                            "status": "Removed",
                            "post_date": row.get('post_date', ''), # Might lose this if not persisted
                            "recs": 0,
                            "comments": 0,
                            "url": url,
                            "removed_date": removed_date
                }
            
            # Update Row for CSV
            row['status'] = new_status
            row['max_views'] = max_views
            row['current_views'] = current_views
            row['removed_date'] = removed_date
            row['last_updated'] = datetime.now().strftime('%Y-%m-%d')
            
            updated_rows.append(row)
            time.sleep(0.5)

    # Write back to CSV
    headers = ['english_name', 'korean_name', 'url', 'status', 'max_views', 'current_views', 'removed_date', 'last_updated']
    with open(MASTER_DB_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(updated_rows) # Note: this drops fields not in header if any
        
    # Write JSON
    with open(JSON_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=4)
        
    logger.info("Update complete.")

if __name__ == "__main__":
    update_counts()
