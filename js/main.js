document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // Setup filter functionality
    const filterInput = document.getElementById('filter-input');
    if (filterInput) {
        filterInput.addEventListener('keyup', filterTable);
    }
});

let universityData = {};

async function loadData() {
    try {
        const response = await fetch('js/university_data.json');
        universityData = await response.json();
        renderTable(Object.values(universityData));
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('error-display').style.display = 'block';
        document.getElementById('error-display').textContent = 'Error loading dashboard data.';
    }
}

function renderTable(data, sortField = 'default') {
    const tableBody = document.querySelector('tbody');
    tableBody.innerHTML = '';

    // Sort Logic
    // Default: Status (Active > Removed), then Current Views (Desc)
    data.sort((a, b) => {
        // 1. Status Priority: Active (1) > Removed (0)
        const statusA = a.status === 'Active' ? 1 : 0;
        const statusB = b.status === 'Active' ? 1 : 0;

        if (statusA !== statusB) {
            return statusB - statusA; // Active first
        }

        // 2. Secondary Sort: Views (High to Low)
        // Ensure numbers
        const viewA = parseInt(a.current_views) || 0;
        const viewB = parseInt(b.current_views) || 0;
        
        // If both removed, maybe sort by Max Views?
        if (statusA === 0) {
             const maxA = parseInt(a.max_views) || 0;
             const maxB = parseInt(b.max_views) || 0;
             return maxB - maxA;
        }

        return viewB - viewA;
    });

    // Populate Metrics
    let totalViews = 0;
    let activePosts = 0;
    let totalIncrease = 0;
    let activeItems = [];
    
    data.forEach(item => {
        if (item.status === 'Active') {
            const curr = parseInt(item.current_views) || 0;
            const init = parseInt(item.initial_views) || 0;
            totalViews += curr;
            activePosts++;
            totalIncrease += (curr - init);
            activeItems.push(item);
        }
    });
    
    // Update Stats UI
    const totalViewsEl = document.querySelector('.total-views h3');
    if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString();
    
    const totalIncreaseEl = document.querySelector('.total-increase h3');
    if (totalIncreaseEl) totalIncreaseEl.textContent = `+${totalIncrease.toLocaleString()}`;
    if (totalIncrease > 0 && totalIncreaseEl) totalIncreaseEl.style.color = '#bb86fc';

    const avgIncreaseEl = document.querySelector('.avg-increase h3');
    if (avgIncreaseEl) {
        const avg = activePosts > 0 ? (totalIncrease / activePosts).toFixed(1) : 0;
        avgIncreaseEl.textContent = `+${avg}`;
    }

    // Update Chart
    renderChart(activeItems);

    data.forEach(item => {
        const row = document.createElement('tr');
        
        // Row styling for Removed
        if (item.status === 'Removed') {
            row.style.opacity = '0.6';
            row.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
        }

        // Date Posted Tooltip
        if (item.post_date) {
            row.setAttribute('title', `Posted: ${item.post_date}`);
        }

        // 1. Status Column
        const statusCell = document.createElement('td');
        if (item.status === 'Active') {
            statusCell.innerHTML = '<span style="color: #4caf50; font-weight: bold;">✔ Active</span>';
        } else {
            statusCell.innerHTML = `<span style="color: #f44336;">✘ Removed</span><br><span style="font-size:0.8em; color:#888;">${item.removed_date || ''}</span>`;
        }
        statusCell.style.textAlign = 'center';
        row.appendChild(statusCell);

        // 2. English Name
        const nameEnCell = document.createElement('td');
        nameEnCell.textContent = item.name_en;
        row.appendChild(nameEnCell);

        // 3. Korean Name
        const nameKrCell = document.createElement('td');
        nameKrCell.textContent = item.name_kr;
        row.appendChild(nameKrCell);

        // 4. Max Views (formerly Initial) - Renaming conceptual purpose
        const maxViewsCell = document.createElement('td');
        maxViewsCell.textContent = (item.max_views || 0).toLocaleString();
        row.appendChild(maxViewsCell);

        // 5. Current Views
        const currViewsCell = document.createElement('td');
        if (item.status === 'Active') {
            currViewsCell.textContent = (item.current_views || 0).toLocaleString();
            currViewsCell.style.fontWeight = 'bold';
            currViewsCell.style.color = '#e0e0e0';
        } else {
             currViewsCell.textContent = "-";
        }
        row.appendChild(currViewsCell);

        // 6. Recs / Comments
        const engagementCell = document.createElement('td');
        engagementCell.textContent = `${item.recs || 0} / ${item.comments || 0}`;
        row.appendChild(engagementCell);

        // 7. Actions
        const actionCell = document.createElement('td');
        const link = document.createElement('a');
        link.href = item.url;
        link.textContent = 'View Post';
        link.className = 'btn-view';
        link.target = '_blank';
        actionCell.appendChild(link);
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });
}

let viewsChart = null;

function renderChart(activeItems) {
    const ctx = document.getElementById('viewsChart');
    if (!ctx) return;

    // Sort by Increase (Desc) for chart
    activeItems.sort((a, b) => {
        const incA = (parseInt(a.current_views) || 0) - (parseInt(a.initial_views) || 0);
        const incB = (parseInt(b.current_views) || 0) - (parseInt(b.initial_views) || 0);
        return incB - incA;
    });

    const top10 = activeItems.slice(0, 10);
    const labels = top10.map(i => i.name_kr || i.name_en);
    const initialData = top10.map(i => parseInt(i.initial_views) || 0);
    const currentData = top10.map(i => parseInt(i.current_views) || 0);
    
    // Calculate increases for 'stacked' visual or just show current vs initial
    // In ChartJS, a second dataset overlays.
    
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
                    backgroundColor: 'rgba(100, 149, 237, 0.7)',
                    borderColor: 'rgba(100, 149, 237, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Current Views',
                    data: currentData,
                    backgroundColor: 'rgba(187, 134, 252, 0.7)',
                    borderColor: 'rgba(187, 134, 252, 1)',
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
                    text: 'Top 10 Active Universities by Views',
                    color: '#e0e0e0',
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: '#e0e0e0' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { color: '#e0e0e0' }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#e0e0e0' }
                }
            }
        }
    });
}

function filterTable() {
    const input = document.getElementById('filter-input');
    const filter = input.value.toUpperCase();
    const rows = document.querySelector('tbody').getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const enName = rows[i].getElementsByTagName('td')[1];
        const krName = rows[i].getElementsByTagName('td')[2];
        if (enName || krName) {
            const txtValueEn = enName.textContent || enName.innerText;
            const txtValueKr = krName.textContent || krName.innerText;
            if (txtValueEn.toUpperCase().indexOf(filter) > -1 || txtValueKr.toUpperCase().indexOf(filter) > -1) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
            }
        }
    }
}
