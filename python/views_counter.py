import requests
from bs4 import BeautifulSoup
import json
import re
import os
import csv
from datetime import datetime
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

def extract_view_count(html_content):
    """Extract view count from DC Inside HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the view count span with class "gall_count"
    view_count_span = soup.find('span', class_='gall_count')
    
    if view_count_span:
        # Extract the number from "조회 X" format
        count_text = view_count_span.text.strip()
        count_match = re.search(r'조회\s+(\d+)', count_text)
        
        if count_match:
            return int(count_match.group(1))
    
    return None

def extract_recommendation_count(html_content):
    """Extract recommendation count from DC Inside HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the recommendation count span with class "gall_reply_num"
    recommendation_span = soup.find('span', class_='gall_reply_num')
    
    if recommendation_span:
        # Extract the number from "추천 X" format
        rec_text = recommendation_span.text.strip()
        rec_match = re.search(r'추천\s+(\d+)', rec_text)
        
        if rec_match:
            return int(rec_match.group(1))
    
    return 0

def extract_comment_count(html_content):
    """Extract comment count from DC Inside HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the comment count span with class "gall_comment"
    comment_span = soup.find('span', class_='gall_comment')
    
    if comment_span:
        # Extract the number from "댓글 X" format
        comment_text = comment_span.text.strip()
        comment_match = re.search(r'댓글\s+(\d+)', comment_text)
        
        if comment_match:
            return int(comment_match.group(1))
    
    return 0

def extract_post_date(html_content):
    """Extract post date from DC Inside HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the date span with class "gall_date"
    date_span = soup.find('span', class_='gall_date')
    
    if date_span and date_span.get('title'):
        return date_span.get('title')
    
    return None

def extract_post_title(html_content):
    """Extract post title from DC Inside HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the title in the <h3> tag with class "title"
    title_tag = soup.find('h3', class_='title')
    
    if title_tag and title_tag.span and title_tag.span.get_text():
        return title_tag.span.get_text().strip()
    
    return None

def get_university_data():
    """Parse the CSV file and extract university data with URLs"""
    universities = []
    
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sources', 'dc_inside_post_urls.csv')
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            universities.append({
                'name': row['english_name'],
                'korean_name': row['korean_name'],
                'initial_count': int(row['initial_count']),
                'url': row['url'],
                'date_accessed': row['date_accessed']
            })
    
    return universities

def fetch_view_counts():
    """Fetch current view counts and other metrics for all universities"""
    universities = get_university_data()
    results = []
    
    logger.info(f"Fetching data for {len(universities)} universities...")
    
    for i, uni in enumerate(universities):
        try:
            logger.info(f"Processing {i+1}/{len(universities)}: {uni['name']} ({uni['korean_name']})")
            response = requests.get(uni['url'], headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            })
            
            if response.status_code == 200:
                html_content = response.text
                
                # Extract metrics from HTML
                current_count = extract_view_count(html_content)
                recommendation_count = extract_recommendation_count(html_content)
                comment_count = extract_comment_count(html_content)
                post_date = extract_post_date(html_content)
                post_title = extract_post_title(html_content)
                
                if current_count is not None:
                    # Calculate increase from initial count
                    increase = current_count - uni['initial_count']
                    increase_percent = (increase / uni['initial_count'] * 100) if uni['initial_count'] > 0 else 0
                    
                    logger.info(f"  - Views: {current_count} (increase: {increase})")
                    
                    results.append({
                        'name': uni['name'],
                        'korean_name': uni['korean_name'],
                        'initial_count': uni['initial_count'],
                        'current_count': current_count,
                        'increase': increase,
                        'increase_percent': round(increase_percent, 2),
                        'recommendation_count': recommendation_count,
                        'comment_count': comment_count,
                        'post_date': post_date,
                        'post_title': post_title,
                        'last_accessed': uni['date_accessed'],
                        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'url': uni['url']
                    })
                else:
                    logger.warning(f"  - Could not extract view count for {uni['name']}")
                    # If we couldn't extract the count, use the initial count
                    results.append({
                        'name': uni['name'],
                        'korean_name': uni['korean_name'],
                        'initial_count': uni['initial_count'],
                        'current_count': uni['initial_count'],
                        'increase': 0,
                        'increase_percent': 0,
                        'recommendation_count': recommendation_count,
                        'comment_count': comment_count,
                        'post_date': post_date,
                        'post_title': post_title,
                        'last_accessed': uni['date_accessed'],
                        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'url': uni['url']
                    })
            else:
                logger.error(f"  - Request failed with status code {response.status_code} for {uni['name']}")
                # If request failed, use the initial count
                results.append({
                    'name': uni['name'],
                    'korean_name': uni['korean_name'],
                    'initial_count': uni['initial_count'],
                    'current_count': uni['initial_count'],
                    'increase': 0,
                    'increase_percent': 0,
                    'recommendation_count': 0,
                    'comment_count': 0,
                    'post_date': None,
                    'post_title': None,
                    'last_accessed': uni['date_accessed'],
                    'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'url': uni['url']
                })
        except Exception as e:
            logger.error(f"  - Error fetching data for {uni['name']}: {str(e)}")
            # If exception occurred, use the initial count
            results.append({
                'name': uni['name'],
                'korean_name': uni['korean_name'],
                'initial_count': uni['initial_count'],
                'current_count': uni['initial_count'],
                'increase': 0,
                'increase_percent': 0,
                'recommendation_count': 0,
                'comment_count': 0,
                'post_date': None,
                'post_title': None,
                'last_accessed': uni['date_accessed'],
                'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'url': uni['url'],
                'error': str(e)
            })
    
    # Sort by increase (descending)
    results.sort(key=lambda x: x['increase'], reverse=True)
    logger.info(f"Sorted results by increase. Top university: {results[0]['name']} with {results[0]['increase']} increase")
    
    return results

def save_results_to_json():
    """Save scraped results to a JSON file for the dashboard to use"""
    results = fetch_view_counts()
    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'js', 'university_data.json')
    
    # Ensure the directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Add metadata to the results
    data = {
        'metadata': {
            'total_universities': len(results),
            'total_views': sum(uni['current_count'] for uni in results),
            'total_increase': sum(uni['increase'] for uni in results),
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'average_increase': round(sum(uni['increase'] for uni in results) / len(results), 2) if results else 0
        },
        'universities': results
    }
    
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    
    logger.info(f"JSON data saved to {output_path}")
    
    # Also save as CSV for easy analysis
    csv_output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sources', 'university_data_current.csv')
    
    with open(csv_output_path, 'w', encoding='utf-8', newline='') as file:
        fieldnames = ['name', 'korean_name', 'initial_count', 'current_count', 'increase', 
                     'increase_percent', 'recommendation_count', 'comment_count', 
                     'post_date', 'post_title', 'last_accessed', 'last_updated', 'url']
        
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        
        for uni in results:
            # Create a copy without the 'error' field for CSV
            uni_data = {key: uni[key] for key in fieldnames if key in uni}
            writer.writerow(uni_data)
    
    logger.info(f"CSV data saved to {csv_output_path}")
    
    # Update the initial counts in the original CSV file
    update_initial_counts(results)
    
    return data

def update_initial_counts(results):
    """Update the initial_count values in the CSV file with current counts"""
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sources', 'dc_inside_post_urls.csv')
    temp_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sources', 'dc_inside_post_urls_temp.csv')
    
    # Create a dictionary for fast lookup
    uni_data = {uni['name']: uni for uni in results}
    
    logger.info("Updating initial counts in the CSV file...")
    
    # Read the original file and write to a temporary file with updated values
    with open(csv_path, 'r', encoding='utf-8') as infile, \
         open(temp_path, 'w', encoding='utf-8', newline='') as outfile:
        
        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames
        
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        for row in reader:
            name = row['english_name']
            if name in uni_data and 'current_count' in uni_data[name]:
                # Update the initial count with the current count
                row['initial_count'] = str(uni_data[name]['current_count'])
                row['date_accessed'] = today
                logger.info(f"Updated {name}: initial_count set to {row['initial_count']}")
            
            writer.writerow(row)
    
    # Replace the original file with the updated one
    os.replace(temp_path, csv_path)
    logger.info(f"CSV file updated at {csv_path}")

if __name__ == "__main__":
    # When run directly, scrape and save the data
    logger.info("Starting views counter script")
    save_results_to_json()
    logger.info("Views counter script completed")
