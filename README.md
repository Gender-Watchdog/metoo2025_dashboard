# #MeTooKorea2025 Dashboard

A dashboard for monitoring view counts of posts on DC Inside by university.

## Overview

This dashboard tracks the view counts of specific DC Inside posts related to various universities. It displays the initial count, current count, and increase in views for each university, along with visualizations and statistics.

## Features

- View count tracking for posts related to 23 universities
- Interactive data visualization with Chart.js
- Sorting and filtering capabilities
- Mobile-responsive design
- Bilingual support (English and Korean university names)

## Structure

- `index.html` - Main dashboard page
- `css/styles.css` - Styling for the dashboard
- `js/main.js` - JavaScript for interactive features
- `js/university_data.json` - Data storage for university metrics
- `python/views_counter.py` - Python script for scraping view counts (used locally)
- `.github/workflows/update-data.yml` - GitHub Actions workflow for automatic data updates

## How to Use

1. Visit the dashboard at https://dashboard.genderwatchdog.org/
2. Use the search box to filter universities by name
3. Use the dropdown to sort by different metrics
4. Click the "View on GitHub" button to visit the repository

## Data Sources

The data is sourced from DC Inside posts listed in `sources/dc_inside_post_urls.csv`. The view counts are extracted from the HTML of these posts using the BeautifulSoup library in Python.

## GitHub Pages Deployment

This dashboard is designed to be deployed on GitHub Pages:

1. Fork or clone this repository
2. Enable GitHub Pages in your repository settings
3. The dashboard will be available at https://USERNAME.github.io/metoo2025_dashboard/

## Data Updates

Data is automatically updated daily via GitHub Actions. To update manually:

1. Run the Python scraper locally:
   ```bash
   python python/views_counter.py
   ```
2. Commit and push the updated data files

## Requirements for Local Development

- Python 3.x with the following packages:
  - requests
  - BeautifulSoup4
  - json
  - re

## Legal & Licensing

### Truthful Posture Statement
This is an independently funded investigative project dedicated to transparency and public interest. We operate autonomously without affiliation to any political organization or corporate entity.

### Licensing Information
This project operates under a dual-license model:
- **Source Code**: The software, scripts, and configuration files are licensed under the [Apache License, Version 2.0](LICENSE).
- **Content**: The datasets, investigative reports, and written documentation are licensed under the [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International Public License](LICENSE-CONTENT).

### Disclaimers
The information provided in this dashboard is for educational and informational purposes only. We do not provide legal advice, nor do we verify or issue official accreditation for any institution mentioned. Users are encouraged to independently verify all data.

## Credits

Created by GenderWatchdog, 2025. All rights reserved. 