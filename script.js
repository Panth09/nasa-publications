import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ──────────────────────────────────────────────────────────────
// SAFE JSON PARSER – put this at the very top of the file
// ──────────────────────────────────────────────────────────────
function safeJsonParse(str, fallback = []) {
    if (!str || str === '') return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn('Invalid JSON – using fallback:', str);
        return fallback;
    }
}

// ──────────────────────────────────────────────────────────────
// State management
// ──────────────────────────────────────────────────────────────
let allPublications = [];
let filteredPublications = [];
let currentPage = 1;
const itemsPerPage = 10;

// ──────────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadPublications();
    setupEventListeners();
    populateFilters();
    updateStats();
    displayPublications();
});

// ──────────────────────────────────────────────────────────────
// Load publications from Firestore
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Search
// ──────────────────────────────────────────────────────────────
function handleSearch() {
    const term = document.getElementById('searchInput').value.trim().toLowerCase();

    if (!term) {
        filteredPublications = [...allPublications];
    } else {
        filteredPublications = allPublications.filter(pub => {
            const text = `
                ${pub.title || ''}
                ${pub.abstract || ''}
                ${Array.isArray(pub.key_findings) ? pub.key_findings.join(' ') : ''}
            `.toLowerCase();
            return text.includes(term);
        });
    }

    currentPage = 1;
    displayPublications();
}

// ──────────────────────────────────────────────────────────────
// Filters
// ──────────────────────────────────────────────────────────────
function applyFilters() {
    const domain = document.getElementById('domainFilter').value;
    const system = document.getElementById('systemFilter').value;
    const year = document.getElementById('yearFilter').value;

    filteredPublications = allPublications.filter(pub => {
        let ok = true;

        if (domain) {
            const domains = safeJsonParse(pub.research_domains);
            ok = ok && domains.includes(domain);
        }

        if (system) {
            const systems = safeJsonParse(pub.biological_systems);
            ok = ok && systems.includes(system);
        }

        if (year) {
            ok = ok && pub.publication_year === parseInt(year);
        }

        return ok;
    });

    currentPage = 1;
    displayPublications();
}

// ──────────────────────────────────────────────────────────────
// Reset filters
// ──────────────────────────────────────────────────────────────
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('domainFilter').value = '';
    document.getElementById('systemFilter').value = '';
    document.getElementById('yearFilter').value = '';

    filteredPublications = [...allPublications];
    currentPage = 1;
    displayPublications();
}

// ──────────────────────────────────────────────────────────────
// Populate dropdowns
// ──────────────────────────────────────────────────────────────
function populateFilters() {
    const domains = new Set();
    const systems = new Set();
    const years = new Set();

    allPublications.forEach(pub => {
        safeJsonParse(pub.research_domains).forEach(d => domains.add(d));
        safeJsonParse(pub.biological_systems).forEach(s => systems.add(s));
        if (pub.publication_year) years.add(pub.publication_year);
    });

    populateSelect('domainFilter', Array.from(domains).sort());
    populateSelect('systemFilter', Array.from(systems).sort());
    populateSelect('yearFilter', Array.from(years).sort((a, b) => b - a));
}

function populateSelect(id, options) {
    const select = document.getElementById(id);
    const placeholder = select.options[0];
    select.innerHTML = '';
    select.appendChild(placeholder);

    options.forEach(opt => {
        if (opt) {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            select.appendChild(el);
        }
    });
}

// ──────────────────────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────────────────────
function updateStats() {
    document.getElementById('totalCount').textContent = allPublications.length;

    const domainSet = new Set();
    allPublications.forEach(pub => {
        safeJsonParse(pub.research_domains).forEach(d => domainSet.add(d));
    });
    document.getElementById('domainCount').textContent = domainSet.size;

    const durations = allPublications
        .filter(p => p.experiment_duration_days)
        .map(p => p.experiment_duration_days);
    const avg = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    document.getElementById('avgDuration').textContent = avg;
}

// ──────────────────────────────────────────────────────────────
// Render page
// ──────────────────────────────────────────────────────────────
function displayPublications() {
    const container = document.getElementById('results');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const page = filteredPublications.slice(start, end);

    if (!page.length) {
        container.innerHTML = '<div class="loading">No publications found matching your criteria.</div>';
        return;
    }

    container.innerHTML = page.map(createPublicationCard).join('');
    updatePagination();
}

// ──────────────────────────────────────────────────────────────
// Card HTML
// ──────────────────────────────────────────────────────────────
function createPublicationCard(pub) {
    const domains = safeJsonParse(pub.research_domains);
    const systems = safeJsonParse(pub.biological_systems);
    const findings = safeJsonParse(pub.key_findings);

    const domainBadges = domains.map(d =>
        `<span class="badge badge-domain">${d.replace(/_/g, ' ')}</span>`
    ).join('');

    const systemBadges = systems.map(s =>
        `<span class="badge badge-system">${s.replace(/_/g, ' ')}</span>`
    ).join('');

    const findingsList = findings.length
        ? `<div class="findings"><h4>Key Findings:</h4><ul>${findings.map(f => `<li>${f}</li>`).join('')}</ul></div>`
        : '';

    return `
        <article class="publication-card">
            <div class="publication-header">
                <h2 class="publication-title">
                    <a href="${pub.link || '#'}" target="_blank" rel="noopener noreferrer">
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

// ──────────────────────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────────────────────
function updatePagination() {
    const totalPages = Math.ceil(filteredPublications.length / itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function changePage(dir) {
    currentPage += dir;
    displayPublications();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}