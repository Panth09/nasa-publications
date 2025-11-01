import { collection, query, where, getDocs, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// State management
let allPublications = [];
let filteredPublications = [];
let currentPage = 1;
const itemsPerPage = 10;
let lastVisible = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadPublications();
    setupEventListeners();
    populateFilters();
    updateStats();
    displayPublications();
});

// Load publications from Firestore
async function loadPublications() {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    
    try {
        loading.style.display = 'block';
        results.style.display = 'none';
        
        const publicationsRef = collection(window.db, 'publications');
        const q = query(publicationsRef, orderBy('created_at', 'desc'));
        const querySnapshot = await getDocs(q);
        
        allPublications = [];
        querySnapshot.forEach((doc) => {
            allPublications.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        filteredPublications = [...allPublications];
        
        loading.style.display = 'none';
        results.style.display = 'grid';
        
    } catch (error) {
        console.error('Error loading publications:', error);
        loading.innerHTML = `<p style="color: red;">Error loading publications. Please check console.</p>`;
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    document.getElementById('domainFilter').addEventListener('change', applyFilters);
    document.getElementById('systemFilter').addEventListener('change', applyFilters);
    document.getElementById('yearFilter').addEventListener('change', applyFilters);
    
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    document.getElementById('prevBtn').addEventListener('click', () => changePage(-1));
    document.getElementById('nextBtn').addEventListener('click', () => changePage(1));
}

// Handle search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filteredPublications = [...allPublications];
    } else {
        filteredPublications = allPublications.filter(pub => {
            const searchableText = `
                ${pub.title || ''} 
                ${pub.abstract || ''} 
                ${pub.key_findings || ''}
            `.toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
    }
    
    currentPage = 1;
    displayPublications();
}

// Apply filters
function applyFilters() {
    const domainFilter = document.getElementById('domainFilter').value;
    const systemFilter = document.getElementById('systemFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    
    filteredPublications = allPublications.filter(pub => {
        let matches = true;
        
        if (domainFilter && pub.research_domains) {
            const domains = JSON.parse(pub.research_domains || '[]');
            matches = matches && domains.includes(domainFilter);
        }
        
        if (systemFilter && pub.biological_systems) {
            const systems = JSON.parse(pub.biological_systems || '[]');
            matches = matches && systems.includes(systemFilter);
        }
        
        if (yearFilter) {
            matches = matches && pub.publication_year === parseInt(yearFilter);
        }
        
        return matches;
    });
    
    currentPage = 1;
    displayPublications();
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('domainFilter').value = '';
    document.getElementById('systemFilter').value = '';
    document.getElementById('yearFilter').value = '';
    
    filteredPublications = [...allPublications];
    currentPage = 1;
    displayPublications();
}

// Populate filter dropdowns
function populateFilters() {
    const domains = new Set();
    const systems = new Set();
    const years = new Set();
    
    allPublications.forEach(pub => {
        if (pub.research_domains) {
            JSON.parse(pub.research_domains).forEach(d => domains.add(d));
        }
        if (pub.biological_systems) {
            JSON.parse(pub.biological_systems).forEach(s => systems.add(s));
        }
        if (pub.publication_year) {
            years.add(pub.publication_year);
        }
    });
    
    populateSelect('domainFilter', Array.from(domains).sort());
    populateSelect('systemFilter', Array.from(systems).sort());
    populateSelect('yearFilter', Array.from(years).sort((a, b) => b - a));
}

// Helper to populate select element
function populateSelect(elementId, options) {
    const select = document.getElementById(elementId);
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);
    
    options.forEach(option => {
        if (option) {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            select.appendChild(opt);
        }
    });
}

// Update statistics
function updateStats() {
    document.getElementById('totalCount').textContent = allPublications.length;
    
    const domains = new Set();
    allPublications.forEach(pub => {
        if (pub.research_domains) {
            JSON.parse(pub.research_domains).forEach(d => domains.add(d));
        }
    });
    document.getElementById('domainCount').textContent = domains.size;
    
    const durations = allPublications
        .filter(pub => pub.experiment_duration_days)
        .map(pub => pub.experiment_duration_days);
    const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    document.getElementById('avgDuration').textContent = avgDuration;
}

// Display publications for current page
function displayPublications() {
    const results = document.getElementById('results');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pagePublications = filteredPublications.slice(startIndex, endIndex);
    
    if (pagePublications.length === 0) {
        results.innerHTML = '<div class="loading">No publications found matching your criteria.</div>';
        return;
    }
    
    results.innerHTML = pagePublications.map(pub => createPublicationCard(pub)).join('');
    
    updatePagination();
}

// Create publication card HTML
function createPublicationCard(pub) {
    const domains = JSON.parse(pub.research_domains || '[]');
    const systems = JSON.parse(pub.biological_systems || '[]');
    const findings = JSON.parse(pub.key_findings || '[]');
    
    const domainBadges = domains.map(d => 
        `<span class="badge badge-domain">${d.replace(/_/g, ' ')}</span>`
    ).join('');
    
    const systemBadges = systems.map(s => 
        `<span class="badge badge-system">${s.replace(/_/g, ' ')}</span>`
    ).join('');
    
    const findingsList = findings.length > 0 
        ? `<div class="findings">
            <h4>Key Findings:</h4>
            <ul>
                ${findings.map(f => `<li>${f}</li>`).join('')}
            </ul>
           </div>`
        : '';
    
    return `
        <article class="publication-card">
            <div class="publication-header">
                <h2 class="publication-title">
                    <a href="${pub.link}" target="_blank" rel="noopener noreferrer">
                        ${pub.title || 'Untitled Publication'}
                    </a>
                </h2>
            </div>
            
            <div class="badges">
                ${domainBadges}
                ${systemBadges}
                ${pub.publication_year ? `<span class="badge badge-year">${pub.publication_year}</span>` : ''}
                ${pub.experiment_duration_days ? `<span class="badge badge-duration">${pub.experiment_duration_days} days</span>` : ''}
            </div>
            
            <p class="publication-abstract">
                ${pub.abstract ? (pub.abstract.substring(0, 300) + (pub.abstract.length > 300 ? '...' : '')) : 'No abstract available.'}
            </p>
            
            ${findingsList}
        </article>
    `;
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(filteredPublications.length / itemsPerPage);
    
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

// Change page
function changePage(direction) {
    currentPage += direction;
    displayPublications();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}