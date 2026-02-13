document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // Setup filter functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filterTable);
    }
    
    // Sort Select Listener
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
             renderTable(universityData);
        });
    }

    // Refresh Btn (GitHub Link)
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            window.open('https://github.com/genderwatchdog1/metoo2025_dashboard', '_blank');
        });
    }
});

let universityData = [];

async function loadData() {
    try {
        const response = await fetch('js/university_data.json');
        const rawData = await response.json();
        
        // Handle different possible JSON structures
        if (Array.isArray(rawData)) {
            universityData = rawData;
        } else if (rawData.universities && Array.isArray(rawData.universities)) {
            universityData = rawData.universities;
        } else {
            // Fallback: object of objects
            universityData = Object.values(rawData);
        }

        renderTable(universityData);
        updateStatistics(universityData);
    } catch (error) {
        console.error('Error loading data:', error);
        const errorDisplay = document.getElementById('error-display');
        if (errorDisplay) {
            errorDisplay.style.display = 'block';
            errorDisplay.textContent = 'Error loading dashboard data.';
        }
    }
}

function updateStatistics(data) {
    let totalViews = 0;
    let activePosts = 0;
    let totalIncrease = 0;
    
    data.forEach(item => {
        if (item.status === 'Active') {
            const curr = parseInt(item.current_views) || 0;
            const init = parseInt(item.initial_views) || 0;
            totalViews += curr;
            activePosts++;
            totalIncrease += (curr - init);
        }
    });

    const totalViewsEl = document.getElementById('total-current-views');
    if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString();
    
    const totalIncreaseEl = document.getElementById('total-increase');
    if (totalIncreaseEl) {
        totalIncreaseEl.textContent = `+${totalIncrease.toLocaleString()}`;
        if (totalIncrease > 0) totalIncreaseEl.style.color = '#8338ec';
    }

    const avgIncreaseEl = document.getElementById('avg-increase');
    if (avgIncreaseEl) {
        const avg = activePosts > 0 ? (totalIncrease / activePosts).toFixed(1) : 0;
        avgIncreaseEl.textContent = `+${avg}`;
    }
    
    // Update timestamp
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const lastUpdatedSpan = document.getElementById('last-updated');
    if (lastUpdatedSpan) lastUpdatedSpan.textContent = `Last updated: ${dateStr}`;
    const footerDate = document.getElementById('footer-updated-date');
    if (footerDate) footerDate.textContent = dateStr;
}

function renderTable(data) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const sortSelect = document.getElementById('sort-select');
    const sortValue = sortSelect ? sortSelect.value : 'increase-desc';

    // Filter Logic
    const searchInput = document.getElementById('search-input');
    const filterText = searchInput ? searchInput.value.toLowerCase() : '';
    
    let filteredData = data.filter(item => {
        // Handle field naming variations (name vs english_name)
        const name = (item.name || item.english_name || item.name_en || '').toLowerCase();
        const korean = (item.korean_name || item.name_kr || '').toLowerCase();
        const title = (item.post_title || '').toLowerCase();
        return name.includes(filterText) || korean.includes(filterText) || title.includes(filterText);
    });

    // Sort Logic
    // PRIMARY: Active > Removed
    // SECONDARY: Selected Sort Criteria
    filteredData.sort((a, b) => {
        // 1. Status Priority: Active (1) > Removed (0)
        const statusA = a.status === 'Active' ? 1 : 0;
        const statusB = b.status === 'Active' ? 1 : 0;

        if (statusA !== statusB) {
            return statusB - statusA; // Active first
        }

        // 2. Secondary Sort based on Dropdown
        const getVal = (item, field) => {
            if (field === 'increase') {
                const curr = parseInt(item.current_views) || 0; 
                const init = parseInt(item.initial_views) || 0;
                return curr - init;
            }
            if (field === 'current') return parseInt(item.current_views) || 0;
            if (field === 'recommend') return parseInt(item.recs || item.recommendations || item.recommendation_count) || 0;
            if (field === 'comment') return parseInt(item.comments || item.comment_count) || 0;
            return 0;
        };

        const getName = (item) => (item.name || item.english_name || item.name_en || '').toLowerCase();

        switch (sortValue) {
            case 'increase-desc': return getVal(b, 'increase') - getVal(a, 'increase');
            case 'increase-asc': return getVal(a, 'increase') - getVal(b, 'increase');
            case 'current-desc': return getVal(b, 'current') - getVal(a, 'current');
            case 'current-asc': return getVal(a, 'current') - getVal(b, 'current');
            case 'recommend-desc': return getVal(b, 'recommend') - getVal(a, 'recommend');
            case 'comment-desc': return getVal(b, 'comment') - getVal(a, 'comment');
            case 'name-asc': return getName(a).localeCompare(getName(b));
            case 'name-desc': return getName(b).localeCompare(getName(a));
            default: return getVal(b, 'increase') - getVal(a, 'increase');
        }
    });

    // Update Chart with Active Items Only (top 10 based on sort)
    // Filter active items for the chart to match expected visual
    const activeItems = filteredData.filter(i => i.status === 'Active');
    renderChart(activeItems.slice(0, 10));

    // Render Rows
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        
        // Removed Status Styling
        if (item.status === 'Removed') {
            row.style.opacity = '0.6';
            row.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
        }

        // --- Status Cell ---
        const statusCell = document.createElement('td');
        if (item.status === 'Active') {
            statusCell.innerHTML = '<span style="color: green; font-weight: bold;"><i class="fas fa-check-circle"></i> Active</span>';
        } else {
            statusCell.innerHTML = '<span style="color: red; font-weight: bold;"><i class="fas fa-times-circle"></i> Removed</span>';
        }
        row.appendChild(statusCell);

        // --- University Columns ---
        const nameCell = document.createElement('td');
        const englishName = item.name || item.english_name || item.name_en || 'N/A';
        nameCell.textContent = englishName;
        // Tooltip for post date
        if (item.post_date) {
             nameCell.title = `Posted: ${item.post_date}`;
        }
        row.appendChild(nameCell);

        const koreanCell = document.createElement('td');
        koreanCell.textContent = item.korean_name || item.name_kr || '';
        row.appendChild(koreanCell);

        // --- Metrics ---
        // Initial Views (Historical Context)
        const initCell = document.createElement('td');
        initCell.textContent = (parseInt(item.initial_views) || 0).toLocaleString();
        row.appendChild(initCell);

        // Current Views
        const currCell = document.createElement('td');
        if (item.status === 'Active') {
            currCell.textContent = (parseInt(item.current_views) || 0).toLocaleString();
            currCell.style.fontWeight = 'bold';
        } else {
            currCell.textContent = '-'; 
            currCell.title = "Post Removed";
        }
        row.appendChild(currCell);

        // Increase
        const increaseCell = document.createElement('td');
        if (item.status === 'Active') {
            const curr = parseInt(item.current_views) || 0;
            const init = parseInt(item.initial_views) || 0;
            const inc = curr - init;
            increaseCell.textContent = `+${inc.toLocaleString()}`;
            if (inc > 0) increaseCell.style.color = '#8338ec'; // Tertiary
        } else {
            increaseCell.textContent = '-';
        }
        row.appendChild(increaseCell);

        // Recs / Comments
        const engagementCell = document.createElement('td');
        const recs = item.recs || item.recommendations || item.recommendation_count || 0;
        const coms = item.comments || item.comment_count || 0;
        engagementCell.innerHTML = `<div><i class="far fa-thumbs-up"></i> ${recs}</div><div><i class="far fa-comment-dots"></i> ${coms}</div>`;
        row.appendChild(engagementCell);

        // --- Actions ---
        const actionCell = document.createElement('td');
        if (item.url) {
            const btn = document.createElement('a');
            btn.href = item.url;
            btn.target = '_blank';
            btn.textContent = 'View Post';
            btn.className = 'btn-view';
            btn.style.display = 'inline-block';
            btn.style.padding = '5px 10px';
            btn.style.backgroundColor = '#3a86ff';
            btn.style.color = '#fff';
            btn.style.borderRadius = '4px';
            btn.style.fontSize = '0.8rem';
            btn.style.textDecoration = 'none';
            
            actionCell.appendChild(btn);
        }
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });
}

function filterTable() {
    renderTable(universityData);
}

let viewsChart = null;

function renderChart(data) {
    const ctx = document.getElementById('views-chart');
    if (!ctx) return;

    // Take top 10 from the passed data (which might be sorted/filtered)
    // Assuming data passed here is already active-only or sorted appropriately
    const topData = data.slice(0, 10);
    
    const labels = topData.map(d => d.korean_name || d.name_kr || d.name_en || d.english_name || d.name || 'Unknown');
    const initialData = topData.map(d => parseInt(d.initial_views) || 0);
    const currentData = topData.map(d => parseInt(d.current_views) || 0);
    const recsData = topData.map(d => parseInt(d.recs || d.recommendations || d.recommendation_count) || 0);

    if (viewsChart) {
        viewsChart.destroy();
    }

    viewsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Initial Views',
                    data: initialData,
                    backgroundColor: 'rgba(58, 134, 255, 0.5)',
                    borderColor: 'rgba(58, 134, 255, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Current Views',
                    data: currentData,
                    backgroundColor: 'rgba(131, 56, 236, 0.6)', 
                    borderColor: 'rgba(131, 56, 236, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Recommendations',
                    data: recsData,
                    backgroundColor: 'rgba(255, 0, 110, 0.6)',
                    borderColor: 'rgba(255, 0, 110, 1)',
                    borderWidth: 1,
                    type: 'line',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                y1: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: 'University'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 Active Universities by Views'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            }
        }
    });
}
