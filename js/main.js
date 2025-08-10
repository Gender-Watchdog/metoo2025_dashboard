// Global variables
let universityData = [];
let metadata = {};
let chart = null;

// DOM elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdatedSpan = document.getElementById('last-updated');
const footerUpdatedDate = document.getElementById('footer-updated-date');
const totalCurrentViewsEl = document.getElementById('total-current-views');
const totalIncreaseEl = document.getElementById('total-increase');
const avgIncreaseEl = document.getElementById('avg-increase');
const errorDisplay = document.getElementById('error-display');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Set up event listeners
    searchInput.addEventListener('input', filterTable);
    sortSelect.addEventListener('change', sortTable);
    
    // Change refresh button to direct to GitHub repository
    refreshBtn.addEventListener('click', () => {
        window.open('https://github.com/genderwatchdog1/metoo2025_dashboard', '_blank');
    });
});

// Function to load data from JSON file
async function loadData() {
    try {
        // Clear any previous errors
        errorDisplay.style.display = 'none';
        
        console.log("Attempting to load data from js/university_data.json");
        const response = await fetch('js/university_data.json');
        
        if (!response.ok) {
            console.error("Network response was not ok", response.status, response.statusText);
            throw new Error(`Network response was not ok - Status: ${response.status}`);
        }
        
        // Try to parse the JSON
        let data;
        try {
            const text = await response.text();
            console.log("Received data:", text.substring(0, 200) + "...");
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("JSON parse error:", parseError);
            throw new Error(`JSON parse error: ${parseError.message}`);
        }
        
        // Check if data has the expected structure
        if (!data || !data.universities) {
            console.error("Data structure is invalid", data);
            throw new Error("Invalid data structure: missing 'universities' property");
        }
        
        universityData = data.universities;
        metadata = data.metadata || {};
        
        console.log("Data loaded successfully:", { 
            universities: universityData.length, 
            metadata: metadata 
        });
        
        // Update timestamp
        updateTimestamp();
        
        // Render data
        renderTable();
        renderChart();
        updateStatistics();
        
    } catch (error) {
        console.error('Error loading data:', error);
        errorDisplay.textContent = `Failed to load data: ${error.message}. Please check the browser console for more details.`;
        errorDisplay.style.display = 'block';
        showError(`Failed to load data: ${error.message}`);
        
        // Try to load from CSV as fallback
        tryLoadFromCSV();
    }
}

// Try to load data from CSV as a fallback
async function tryLoadFromCSV() {
    try {
        // Helper to fetch CSV text or return null
        const fetchCSV = async (path) => {
            try {
                const res = await fetch(path);
                if (!res.ok) return null;
                return await res.text();
            } catch (_) {
                return null;
            }
        };

        // Try preferred CSV first, then dc_inside_post_urls.csv as secondary
        console.log("Attempting CSV fallback(s)...");
        let csvText = await fetchCSV('sources/university_data_current.csv');
        let sourceUsed = 'sources/university_data_current.csv';

        if (!csvText) {
            csvText = await fetchCSV('sources/dc_inside_post_urls.csv');
            sourceUsed = 'sources/dc_inside_post_urls.csv';
        }

        if (!csvText) {
            console.error('No CSV fallback available.');
            return;
        }

        const rawRows = parseCSV(csvText);

        if (!rawRows || rawRows.length === 0) {
            console.error('CSV parsed but contained no rows.');
            return;
        }

        // Normalize rows to the structure used by the dashboard
        const normalized = rawRows.map((row) => {
            const name = (row.name || row.english_name || '').trim();
            const koreanName = (row.korean_name || '').trim();
            const initialCount = Number(row.initial_count ?? 0) || 0;
            const currentCount = Number((row.current_count ?? row.initial_count) ?? 0) || initialCount;
            const increaseValue = Number((row.increase ?? (currentCount - initialCount)) ?? 0) || (currentCount - initialCount);
            const incPct = (row.increase_percent !== undefined && row.increase_percent !== null)
                ? Number(row.increase_percent)
                : (initialCount > 0 ? Number(((increaseValue / initialCount) * 100).toFixed(2)) : 0);
            const recs = Number(row.recommendation_count ?? 0) || 0;
            const comments = Number(row.comment_count ?? 0) || 0;
            const url = (row.url || '').trim();
            const postTitle = row.post_title || null;
            const postDate = row.post_date || null;
            const lastAccessed = row.date_accessed || row.last_accessed || null;
            const lastUpdated = row.last_updated || lastAccessed || new Date().toISOString().replace('T', ' ').slice(0, 19);

            return {
                name,
                korean_name: koreanName,
                initial_count: initialCount,
                current_count: currentCount,
                increase: increaseValue,
                increase_percent: incPct,
                recommendation_count: recs,
                comment_count: comments,
                post_date: postDate,
                post_title: postTitle,
                last_accessed: lastAccessed,
                last_updated: lastUpdated,
                url
            };
        });

        // Filter out rows without a name or url to avoid empty entries
        const data = normalized.filter((r) => r.name);

        if (data && data.length > 0) {
            console.log(`Loaded data from CSV (${sourceUsed}):`, data.length, 'records');

            universityData = data;

            // Create metadata
            const totalViews = data.reduce((sum, uni) => sum + (Number(uni.current_count) || 0), 0);
            const totalIncrease = data.reduce((sum, uni) => sum + (Number(uni.increase) || 0), 0);

            metadata = {
                total_universities: data.length,
                total_views: totalViews,
                total_increase: totalIncrease,
                last_updated: data[0]?.last_updated || new Date().toISOString(),
                average_increase: data.length > 0 ? totalIncrease / data.length : 0
            };

            // Update UI
            updateTimestamp();
            renderTable();
            renderChart();
            updateStatistics();

            errorDisplay.textContent = `JSON loading failed, but data was loaded from CSV fallback (${sourceUsed}).`;
            errorDisplay.style.display = 'block';
        }
    } catch (csvError) {
        console.error("CSV fallback failed:", csvError);
    }
}

// Simple CSV parser
function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const obj = {};
        
        headers.forEach((header, i) => {
            // Convert numeric values
            if (['initial_count', 'current_count', 'increase', 'increase_percent', 
                 'recommendation_count', 'comment_count'].includes(header)) {
                obj[header] = parseFloat(values[i] || '0');
            } else {
                obj[header] = values[i];
            }
        });
        
        return obj;
    });
}

// Function to render the table with university data
function renderTable() {
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (!universityData || universityData.length === 0) {
        tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="7">No data available</td>
            </tr>
        `;
        return;
    }
    
    // Create table rows
    universityData.forEach(uni => {
        const row = document.createElement('tr');
        
        // Determine the CSS class for increase value
        let increaseClass = 'increase-neutral';
        if (uni.increase > 0) {
            increaseClass = 'increase-positive';
        } else if (uni.increase < 0) {
            increaseClass = 'increase-negative';
        }
        
        // Build the row HTML
        row.innerHTML = `
            <td>${capitalizeWords(uni.name)}</td>
            <td>${uni.korean_name}</td>
            <td>${uni.initial_count}</td>
            <td>${uni.current_count}</td>
            <td class="${increaseClass}">
                ${uni.increase > 0 ? '+' : ''}${uni.increase}
                ${uni.increase !== 0 ? `(${uni.increase_percent || ((uni.increase / uni.initial_count) * 100).toFixed(1)}%)` : ''}
            </td>
            <td>
                <span title="추천 (Recommendations)">${uni.recommendation_count || 0}</span> / 
                <span title="댓글 (Comments)">${uni.comment_count || 0}</span>
            </td>
            <td>
                <a href="${uni.url}" target="_blank" class="view-link" title="${uni.post_title || 'View post'}">
                    <i class="fas fa-external-link-alt"></i> View Post
                </a>
            </td>
        `;
        
        // Add tooltip with post date if available
        if (uni.post_date) {
            row.setAttribute('title', `Posted: ${uni.post_date}`);
        }
        
        tableBody.appendChild(row);
    });
}

// Function to render the chart
function renderChart() {
    const ctx = document.getElementById('views-chart').getContext('2d');
    
    // If chart already exists, destroy it
    if (chart) {
        chart.destroy();
    }
    
    // Make sure we have data to display
    if (!universityData || universityData.length === 0) {
        return;
    }
    
    // Get top 10 universities by increase
    const topUnis = [...universityData]
        .sort((a, b) => b.increase - a.increase)
        .slice(0, 10);
    
    const labels = topUnis.map(uni => uni.korean_name);
    const initialData = topUnis.map(uni => uni.initial_count);
    const currentData = topUnis.map(uni => uni.current_count);
    const recommendationData = topUnis.map(uni => uni.recommendation_count || 0);
    
    try {
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Initial Views',
                        data: initialData,
                        backgroundColor: 'rgba(58, 134, 255, 0.6)',
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
                        data: recommendationData,
                        backgroundColor: 'rgba(255, 0, 110, 0.6)',
                        borderColor: 'rgba(255, 0, 110, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 10 Universities by Views Increase',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const idx = context.dataIndex;
                                const uni = topUnis[idx];
                                
                                if (context.dataset.label === 'Initial Views' || context.dataset.label === 'Current Views') {
                                    return [
                                        `Increase: ${uni.increase > 0 ? '+' : ''}${uni.increase} (${uni.increase_percent || ((uni.increase / Math.max(1, uni.initial_count)) * 100).toFixed(1)}%)`,
                                        `Comments: ${uni.comment_count || 0}`
                                    ];
                                }
                                return null;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'University'
                        }
                    }
                }
            }
        });
    } catch (chartError) {
        console.error("Error creating chart:", chartError);
        errorDisplay.textContent = `Error creating chart: ${chartError.message}`;
        errorDisplay.style.display = 'block';
    }
}

// Function to update statistics
function updateStatistics() {
    // Use metadata if available, otherwise calculate from universityData
    if (metadata && Object.keys(metadata).length > 0) {
        totalCurrentViewsEl.textContent = metadata.total_views.toLocaleString();
        totalIncreaseEl.textContent = (metadata.total_increase > 0 ? '+' : '') + metadata.total_increase.toLocaleString();
        avgIncreaseEl.textContent = (metadata.average_increase > 0 ? '+' : '') + metadata.average_increase.toFixed(1);
        
        // Update timestamp from metadata
        if (metadata.last_updated) {
            lastUpdatedSpan.textContent = `Last updated: ${metadata.last_updated}`;
            footerUpdatedDate.textContent = metadata.last_updated;
        }
    } else if (universityData && universityData.length > 0) {
        // Calculate if metadata not available
        const totalCurrentViews = universityData.reduce((sum, uni) => sum + (parseInt(uni.current_count) || 0), 0);
        totalCurrentViewsEl.textContent = totalCurrentViews.toLocaleString();
        
        const totalIncrease = universityData.reduce((sum, uni) => sum + (parseInt(uni.increase) || 0), 0);
        totalIncreaseEl.textContent = (totalIncrease > 0 ? '+' : '') + totalIncrease.toLocaleString();
        
        const avgIncrease = totalIncrease / universityData.length;
        avgIncreaseEl.textContent = (avgIncrease > 0 ? '+' : '') + avgIncrease.toFixed(1);
    } else {
        // No data available
        totalCurrentViewsEl.textContent = '0';
        totalIncreaseEl.textContent = '0';
        avgIncreaseEl.textContent = '0';
    }
}

// Function to filter the table based on search input
function filterTable() {
    const searchTerm = searchInput.value.toLowerCase();
    
    // If search is empty, redisplay all data
    if (!searchTerm.trim()) {
        renderTable();
        return;
    }
    
    // Filter universities based on search term
    const filteredData = universityData.filter(uni => 
        uni.name.toLowerCase().includes(searchTerm) || 
        uni.korean_name.toLowerCase().includes(searchTerm) ||
        (uni.post_title && uni.post_title.toLowerCase().includes(searchTerm))
    );
    
    // Store the original data, replace with filtered data, render, then restore
    const originalData = universityData;
    universityData = filteredData;
    renderTable();
    universityData = originalData;
}

// Function to sort the table based on selected option
function sortTable() {
    const sortValue = sortSelect.value;
    
    // Clone the university data for sorting
    const sortedData = [...universityData];
    
    // Sort based on selected option
    switch (sortValue) {
        case 'increase-desc':
            sortedData.sort((a, b) => (b.increase || 0) - (a.increase || 0));
            break;
        case 'increase-asc':
            sortedData.sort((a, b) => (a.increase || 0) - (b.increase || 0));
            break;
        case 'current-desc':
            sortedData.sort((a, b) => (b.current_count || 0) - (a.current_count || 0));
            break;
        case 'current-asc':
            sortedData.sort((a, b) => (a.current_count || 0) - (b.current_count || 0));
            break;
        case 'name-asc':
            sortedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'name-desc':
            sortedData.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
            break;
        case 'recommend-desc':
            sortedData.sort((a, b) => (b.recommendation_count || 0) - (a.recommendation_count || 0));
            break;
        case 'comment-desc':
            sortedData.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
            break;
        default:
            sortedData.sort((a, b) => (b.increase || 0) - (a.increase || 0));
    }
    
    // Store the original data, replace with sorted data, render, then restore
    const originalData = universityData;
    universityData = sortedData;
    renderTable();
    universityData = originalData;
}

// Helper function to update the timestamp
function updateTimestamp() {
    // If timestamp already set from metadata, skip
    if (metadata && metadata.last_updated) {
        lastUpdatedSpan.textContent = `Last updated: ${metadata.last_updated}`;
        footerUpdatedDate.textContent = metadata.last_updated;
        return;
    }
    
    const now = new Date();
    const formattedDate = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    lastUpdatedSpan.textContent = `Last updated: ${formattedDate}`;
    footerUpdatedDate.textContent = formattedDate;
}

// Helper function to show error message
function showError(message) {
    tableBody.innerHTML = `
        <tr class="loading-row">
            <td colspan="7">${message}</td>
        </tr>
    `;
}

// Helper function to capitalize words
function capitalizeWords(str) {
    return str ? str.replace(/\b\w/g, (match) => match.toUpperCase()) : '';
}

// Error handling for script loading
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Error occurred: ", message, source, lineno, colno, error);
    var errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        errorDisplay.textContent = 'Error: ' + message;
        errorDisplay.style.display = 'block';
    }
}; 