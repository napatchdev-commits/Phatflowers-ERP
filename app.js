// ==========================================================================
// CONFIGURATION: ใส่ URL Google Sheets Web App ที่นี่
// เพื่อให้คอมพิวเตอร์และมือถือเชื่อมโยงข้อมูลเหมือนกันทันทีเมื่อเปิดใช้งาน โดยไม่ต้องตั้งค่าซ้ำซ้อน
const GOOGLE_SHEETS_DATABASE_URL = "https://script.google.com/macros/s/AKfycbwo2JfZ_LtbNJD6bvcNa5cq6-8CHUgICqEvNPkZ-Dsm3xCkR9i4EO0r4nMZyf-HQXvW/exec"; 
// ==========================================================================

// Helpers for Cloud Loader Overlay
function showLoadingOverlay(message = 'กำลังโหลดข้อมูล...') {
    const overlay = document.getElementById('cloud-loading-overlay');
    const msgEl = document.getElementById('loader-message');
    if (overlay && msgEl) {
        msgEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('cloud-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Global App State
const state = {
    db: null,
    activeTab: 'dashboard',
    
    // Editor State
    currentDoc: {
        docType: 'quotation', // 'quotation' | 'receipt' | 'delivery'
        docNo: '',
        date: '',
        customerId: '',
        customerName: '',
        customerTaxId: '',
        customerPhone: '',
        customerAddress: '',
        eventDate: '',
        eventLocation: '',
        items: [],
        discount: 0,
        depositOption: 'none',
        depositAmount: 0,
        depositNote: 'ชำระค่ามัดจำ 5,000 บาท ส่วนที่เหลือจ่ายวันติดตั้ง',
        hasTax: false,
        bankName: '',
        bankAccountNo: '',
        bankAccountName: '',
        promptPayNo: '',
        qrCodeBase64: '',
        managerName: '',
        managerPosition: ''
    },
    editingDocId: null, // If editing an existing document
    
    // Modal states
    editingCustomerId: null,
    editingCatalogId: null
};

// Default Database Templates
const DEFAULT_DB = {
    settings: {
        companyName: "ภัทร ฟลาวเวอร์ รับจัดงานแต่ง งานบวช",
        address: "14 หมู่ 3 ตำบลนิลเพชร อำเภอบางเลน จังหวัดนครปฐม 73130",
        taxId: "1 2103 00058 37 0",
        phones: "085-530-4890 , 083-709-6974",
        email: "napatch.dev@gmail.com",
        bankName: "กสิกรไทย",
        bankAccountNo: "034-8-20289-8",
        bankAccountName: "ธนากร แก้วไทรอินทร์",
        promptPayNo: "",
        qrCodeBase64: "",
        managerName: "ธนภัทร ชัยบำรุง",
        managerPosition: "ผู้จัดการ",
        googleSheetsUrl: GOOGLE_SHEETS_DATABASE_URL,
        lineChannelAccessToken: "",
        lineUserId: ""
    },
    customers: [
        {
            id: "cust-1",
            name: "สมชาย รักดี",
            taxId: "3 1012 99999 99 9",
            phone: "081-234-5678",
            address: "123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
            defaultEventDate: "2026-11-28",
            defaultEventLocation: "โรงแรมพลาซ่า แอทธินี กรุงเทพฯ"
        },
        {
            id: "cust-2",
            name: "วิภา รักษ์ความงดงาม",
            taxId: "3 7301 00455 22 1",
            phone: "089-876-5432",
            address: "88 หมู่ 5 ต.ศาลายา อ.พุทธมณฑล จ.นครปฐม 73170",
            defaultEventDate: "2026-12-05",
            defaultEventLocation: "สวนสามพราน จ.นครปฐม"
        }
    ],
    catalog: [
        { id: "cat-1", description: "บริการจัดดอกไม้ฉากหลังเวที (Backdrop) ขนาด 3x6 เมตร", unitPrice: 25000 },
        { id: "cat-2", description: "ซุ้มดอกไม้โค้งทางเข้างาน (Arch)", unitPrice: 12000 },
        { id: "cat-3", description: "แสตนด์ดอกไม้ทางเดิน (Flower Stand) 1 คู่", unitPrice: 3500 },
        { id: "cat-4", description: "ช่อดอกไม้เจ้าสาว", unitPrice: 1500 },
        { id: "cat-5", description: "ดอกไม้ติดหน้าอกประธาน/แขกผู้ใหญ่ (ต่อชิ้น)", unitPrice: 150 },
        { id: "cat-6", description: "พานขันหมากดอกไม้สด (เซ็ต 5 พาน)", unitPrice: 8500 }
    ],
    documents: []
};

/* ==========================================================================
   DATABASE MANAGEMENT
   ========================================================================== */
function loadDB() {
    const data = localStorage.getItem('phatflowers_erp_db');
    if (data) {
        try {
            state.db = JSON.parse(data);
            if (!state.db) {
                state.db = JSON.parse(JSON.stringify(DEFAULT_DB));
            }
            // Ensure all collections exist in case of schema updates
            if (!state.db.settings) state.db.settings = { ...DEFAULT_DB.settings };
            if (state.db.settings) {
                if ((state.db.settings.googleSheetsUrl === undefined || state.db.settings.googleSheetsUrl === '') && GOOGLE_SHEETS_DATABASE_URL) {
                    state.db.settings.googleSheetsUrl = GOOGLE_SHEETS_DATABASE_URL;
                }
                if (state.db.settings.promptPayNo === undefined) state.db.settings.promptPayNo = '';
                if (state.db.settings.qrCodeBase64 === undefined) state.db.settings.qrCodeBase64 = '';
                if (state.db.settings.lineChannelAccessToken === undefined) {
                    state.db.settings.lineChannelAccessToken = state.db.settings.lineNotifyToken || '';
                }
                if (state.db.settings.lineUserId === undefined) state.db.settings.lineUserId = '';
            }
            if (!state.db.customers) state.db.customers = [];
            if (!state.db.catalog) state.db.catalog = [];
            if (!state.db.documents) state.db.documents = [];
        } catch (e) {
            console.error("Error parsing local database. Resetting to defaults.", e);
            state.db = { ...DEFAULT_DB };
            saveDB();
        }
    } else {
        state.db = JSON.parse(JSON.stringify(DEFAULT_DB)); // Deep clone
        saveDB();
    }
}

function saveDB(immediate = false) {
    localStorage.setItem('phatflowers_erp_db', JSON.stringify(state.db));
    if (state.db.settings.googleSheetsUrl) {
        syncPushData(immediate);
    }
}

function resetDB() {
    if (confirm("คุณต้องการล้างข้อมูลทั้งหมดในระบบกลับสู่ค่าเริ่มต้นใช่หรือไม่? (ข้อมูลเดิมทั้งหมดจะสูญหาย)")) {
        state.db = JSON.parse(JSON.stringify(DEFAULT_DB));
        saveDB();
        location.reload();
    }
}

/* ==========================================================================
   APP INITIALIZATION
   ========================================================================== */
// ฟังก์ชันซิงก์ข้อมูลคลาวด์เมื่อโหลดหน้าเว็บ
function initialCloudSync() {
    const url = state.db.settings.googleSheetsUrl;
    if (!url) {
        updateSyncStatus('offline', 'ไม่ได้เชื่อมต่อคลาวด์');
        navigate('dashboard');
        renderDashboard();
        return;
    }

    showLoadingOverlay('กำลังดึงข้อมูลล่าสุดจากคลาวด์...');

    // กำหนดเวลา Timeout 7 วินาที หากเน็ตช้าหรือไม่มีเน็ตให้ข้ามไปใช้ออฟไลน์
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action: 'fetch' }),
        signal: controller.signal
    })
    .then(response => response.json())
    .then(res => {
        clearTimeout(timeoutId);
        if (res.status === 'success' && res.result) {
            const data = res.result;
            // โหลดข้อมูลล่าสุดทับลงฐานข้อมูล
            if (data.customers) state.db.customers = data.customers;
            if (data.catalog) state.db.catalog = data.catalog;
            if (data.documents) state.db.documents = data.documents;
            if (data.settings) {
                const currentUrl = state.db.settings.googleSheetsUrl;
                state.db.settings = { ...state.db.settings, ...data.settings };
                state.db.settings.googleSheetsUrl = currentUrl || data.settings.googleSheetsUrl;
            }
            localStorage.setItem('phatflowers_erp_db', JSON.stringify(state.db));
            updateSyncStatus('success', 'เชื่อมต่อ Google Sheets แล้ว');
        } else {
            console.warn("Initial sync returned empty or error:", res);
            updateSyncStatus('error', 'ดึงข้อมูลคลาวด์ล้มเหลว');
        }
    })
    .catch(err => {
        clearTimeout(timeoutId);
        console.error("Initial cloud sync failed:", err);
        updateSyncStatus('error', 'เชื่อมต่อคลาวด์ล้มเหลว (ใช้ออฟไลน์)');
    })
    .finally(() => {
        hideLoadingOverlay();
        // เรนเดอร์หน้าจอหลังจากพยายามซิงก์เสร็จสิ้น
        navigate('dashboard');
        renderDashboard();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadDB();
    initNavigation();
    initCustomerPage();
    initCatalogPage();
    initDocGeneratorPage();
    initDocHistoryPage();
    initSettingsPage();
    
    // ดึงข้อมูลล่าสุดจากคลาวด์ทันทีก่อนเริ่มเรนเดอร์หน้าจอหลัก
    initialCloudSync();

    // Auto pull sync on window focus (switching back to app tab)
    window.addEventListener('focus', () => {
        if (state.db && state.db.settings && state.db.settings.googleSheetsUrl) {
            syncPullData(false);
        }
    });

    // Polling background sync every 30 seconds
    setInterval(() => {
        if (state.db && state.db.settings && state.db.settings.googleSheetsUrl) {
            syncPullData(false);
        }
    }, 30000);
});

/* Navigation Router */
function initNavigation() {
    const menuItems = document.querySelectorAll('.sidebar .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            navigate(tabId);
            closeSidebar(); // Close sidebar menu drawer on mobile after clicking
        });
    });
}

function navigate(tabId) {
    state.activeTab = tabId;
    
    // Update active sidebar item
    document.querySelectorAll('.sidebar .menu-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update visible tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `${tabId}-tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Trigger render function for specific tabs
    if (tabId === 'dashboard') {
        renderDashboard();
    } else if (tabId === 'customers') {
        renderCustomers();
    } else if (tabId === 'catalog') {
        renderCatalog();
    } else if (tabId === 'doc-generator') {
        renderDocumentGenerator();
    } else if (tabId === 'doc-history') {
        renderDocumentHistory();
    } else if (tabId === 'settings') {
        renderSettings();
    }
}

/* Format Numbers */
function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
    return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseThaiDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

/* ==========================================================================
   CSV EXPORT UTILITIES (For Excel & Google Sheets support)
   ========================================================================== */
function exportToCSV(filename, headers, rows) {
    let csvContent = "\uFEFF"; // UTF-8 BOM for Thai language Excel support
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    rows.forEach(row => {
        csvContent += row.map(cell => {
            const cellStr = cell !== null && cell !== undefined ? String(cell) : '';
            return `"${cellStr.replace(/"/g, '""')}"`;
        }).join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCustomersToCSV() {
    const headers = ["ชื่อลูกค้า", "เบอร์โทร", "เลขประจำตัวผู้เสียภาษี", "ที่อยู่", "วันที่จัดงาน", "สถานที่จัดงาน"];
    const rows = state.db.customers.map(c => [
        c.name,
        c.phone || '',
        c.taxId || '',
        c.address || '',
        c.defaultEventDate || '',
        c.defaultEventLocation || ''
    ]);
    exportToCSV("phatflowers_customers.csv", headers, rows);
}

function exportHistoryToCSV() {
    const headers = ["เลขที่เอกสาร", "ประเภทเอกสาร", "ชื่อลูกค้า", "วันที่เอกสาร", "ราคารวมสุทธิ", "สถานะ", "สถานที่จัดงาน", "วันที่จัดงาน"];
    const typeLabels = { quotation: 'ใบเสนอราคา', receipt: 'ใบเสร็จรับเงิน', delivery: 'ใบส่งสินค้า' };
    const statusLabels = { draft: 'แบบร่าง', sent: 'ส่งเอกสารแล้ว', paid: 'ชำระเงินแล้ว', cancelled: 'ยกเลิก' };
    
    const rows = state.db.documents.map(doc => [
        doc.docNo,
        typeLabels[doc.docType] || doc.docType,
        doc.customerName,
        doc.date,
        doc.grandTotal,
        statusLabels[doc.status] || doc.status,
        doc.eventLocation || '',
        doc.eventDate || ''
    ]);
    exportToCSV("phatflowers_documents_history.csv", headers, rows);
}

/* Generate Document Number */
function generateDocumentNumber(type) {
    const prefixes = {
        quotation: 'QT',
        receipt: 'RC',
        delivery: 'DO'
    };
    const prefix = prefixes[type] || 'DOC';
    
    const now = new Date();
    const year = now.getFullYear(); // A.D. year (e.g. 2026)
    
    // Count documents of this type this year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const count = state.db.documents.filter(doc => {
        if (!doc) return false;
        const docDate = new Date(doc.createdAt || doc.date);
        return doc.docType === type && docDate >= startOfYear;
    }).length + 1;
    
    const serial = String(count).padStart(3, '0');
    return `${prefix}-${year}-${serial}`;
}

/* ==========================================================================
   DASHBOARD SECTION
   ========================================================================== */
function renderDashboard() {
    const docs = (state.db.documents || []).filter(d => d !== null && d !== undefined);
    
    // Math statistics
    const totalQuotations = docs.filter(d => d.docType === 'quotation').length;
    const totalDeliveries = docs.filter(d => d.docType === 'delivery').length;
    const totalReceipts = docs.filter(d => d.docType === 'receipt').length;
    
    // Calculate total sales: sum of Receipts and paid Delivery Orders
    const totalSales = docs
        .filter(d => (d.docType === 'receipt' && d.status === 'paid') || (d.docType === 'delivery' && d.status === 'paid'))
        .reduce((sum, d) => sum + (d.grandTotal || 0), 0);
        
    const customerCount = state.db.customers.length;

    // Set stat values
    document.getElementById('dash-stat-sales').textContent = `฿${formatCurrency(totalSales)}`;
    document.getElementById('dash-stat-quotations').textContent = totalQuotations;
    document.getElementById('dash-stat-receipts').textContent = totalReceipts;
    document.getElementById('dash-stat-customers').textContent = customerCount;

    // Render Recent Documents table
    const recentTableBody = document.querySelector('#dashboard-recent-table tbody');
    recentTableBody.innerHTML = '';
    
    // Get last 5 documents sorted by date/createdAt descending
    const recentDocs = [...docs].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 5);
    
    if (recentDocs.length === 0) {
        recentTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted);">ไม่มีรายการเอกสารเมื่อเร็วๆ นี้</td></tr>`;
        return;
    }

    const typeLabels = { quotation: 'ใบเสนอราคา', receipt: 'ใบเสร็จรับเงิน', delivery: 'ใบส่งสินค้า' };
    const statusLabels = { draft: 'แบบร่าง', sent: 'ส่งเอกสารแล้ว', paid: 'ชำระเงินแล้ว', cancelled: 'ยกเลิก' };

    recentDocs.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: 'Inter', sans-serif; font-weight: 600;">${doc.docNo}</td>
            <td><span class="badge badge-${doc.docType}">${typeLabels[doc.docType]}</span></td>
            <td>${doc.customerName}</td>
            <td>${parseThaiDate(doc.date)}</td>
            <td style="font-family: 'Inter', sans-serif; font-weight: 600;">฿${formatCurrency(doc.grandTotal)}</td>
            <td><span class="badge badge-status-${doc.status || 'draft'}">${statusLabels[doc.status || 'draft']}</span></td>
        `;
        
        // Add click listener to view/edit
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
            editExistingDocument(doc.id);
        });
        
        recentTableBody.appendChild(tr);
    });
}

/* ==========================================================================
   CUSTOMER MANAGEMENT
   ========================================================================== */
function initCustomerPage() {
    // Add customer button
    document.getElementById('btn-add-customer').addEventListener('click', () => {
        openCustomerModal();
    });

    // Export Excel CSV button
    document.getElementById('btn-export-customers-csv').addEventListener('click', () => {
        exportCustomersToCSV();
    });

    // Modal forms submission
    document.getElementById('customer-modal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCustomerForm();
    });

    // Search event
    document.getElementById('customer-search').addEventListener('input', (e) => {
        renderCustomers(e.target.value);
    });
}

function renderCustomers(searchTerm = '') {
    const listBody = document.querySelector('#customer-table tbody');
    listBody.innerHTML = '';
    
    let filtered = (state.db.customers || []).filter(c => c !== null && c !== undefined);
    if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(query) || 
            (c.phone && c.phone.includes(query)) || 
            (c.address && c.address.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted);">ไม่พบข้อมูลลูกค้า</td></tr>`;
        return;
    }

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${c.name}</td>
            <td style="font-family: 'Inter', sans-serif;">${c.phone || '-'}</td>
            <td style="font-family: 'Inter', sans-serif;">${c.taxId || '-'}</td>
            <td>${c.address || '-'}</td>
            <td>${c.defaultEventLocation || '-'}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick="openCustomerModal('${c.id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                    <button class="btn btn-primary btn-sm" onclick="createNewDocForCustomer('${c.id}')"><i class="fas fa-file-invoice"></i> ออกเอกสาร</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function openCustomerModal(id = null) {
    state.editingCustomerId = id;
    const modal = document.getElementById('customer-modal');
    const form = document.getElementById('customer-modal-form');
    const title = document.getElementById('customer-modal-title');
    
    form.reset();
    
    if (id) {
        title.textContent = 'แก้ไขข้อมูลลูกค้า';
        const c = state.db.customers.find(item => item.id === id);
        if (c) {
            document.getElementById('cust-form-name').value = c.name;
            document.getElementById('cust-form-taxid').value = c.taxId || '';
            document.getElementById('cust-form-phone').value = c.phone || '';
            document.getElementById('cust-form-address').value = c.address || '';
            document.getElementById('cust-form-eventdate').value = c.defaultEventDate || '';
            document.getElementById('cust-form-eventlocation').value = c.defaultEventLocation || '';
        }
    } else {
        title.textContent = 'เพิ่มลูกค้าใหม่';
    }
    
    modal.style.display = 'flex';
}

function closeCustomerModal() {
    document.getElementById('customer-modal').style.display = 'none';
}

function saveCustomerForm() {
    const id = state.editingCustomerId;
    const name = document.getElementById('cust-form-name').value.trim();
    const taxId = document.getElementById('cust-form-taxid').value.trim();
    const phone = document.getElementById('cust-form-phone').value.trim();
    const address = document.getElementById('cust-form-address').value.trim();
    const defaultEventDate = document.getElementById('cust-form-eventdate').value;
    const defaultEventLocation = document.getElementById('cust-form-eventlocation').value.trim();
    
    if (!name) {
        alert("กรุณากรอกชื่อลูกค้า");
        return;
    }

    if (id) {
        // Edit mode
        const index = state.db.customers.findIndex(c => c.id === id);
        if (index !== -1) {
            state.db.customers[index] = {
                ...state.db.customers[index],
                name, taxId, phone, address, defaultEventDate, defaultEventLocation
            };
        }
    } else {
        // Add mode
        const newCustomer = {
            id: 'cust-' + Date.now(),
            name, taxId, phone, address, defaultEventDate, defaultEventLocation
        };
        state.db.customers.push(newCustomer);
    }
    
    saveDB(true); // Save and sync immediately
    closeCustomerModal();
    renderCustomers();
}

function deleteCustomer(id) {
    const customer = state.db.customers.find(c => c.id === id);
    if (!customer) return;
    
    if (confirm(`คุณต้องการลบลูกค้า "${customer.name}" ใช่หรือไม่?`)) {
        state.db.customers = state.db.customers.filter(c => c.id !== id);
        saveDB(true); // Save and sync immediately
        renderCustomers();
    }
}

function createNewDocForCustomer(customerId) {
    const c = state.db.customers.find(item => item.id === customerId);
    if (!c) return;
    
    // Clear editor state and load customer
    resetDocEditorState();
    
    state.currentDoc.customerId = c.id;
    state.currentDoc.customerName = c.name;
    state.currentDoc.customerTaxId = c.taxId || '';
    state.currentDoc.customerPhone = c.phone || '';
    state.currentDoc.customerAddress = c.address || '';
    state.currentDoc.eventDate = c.defaultEventDate || '';
    state.currentDoc.eventLocation = c.defaultEventLocation || '';
    
    // Navigate to generator
    navigate('doc-generator');
}

/* ==========================================================================
   CATALOG MANAGEMENT (Item / Services Catalog)
   ========================================================================== */
function initCatalogPage() {
    document.getElementById('btn-add-catalog').addEventListener('click', () => {
        openCatalogModal();
    });

    document.getElementById('catalog-modal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCatalogForm();
    });
    
    document.getElementById('catalog-search').addEventListener('input', (e) => {
        renderCatalog(e.target.value);
    });
}

function renderCatalog(searchTerm = '') {
    const listBody = document.querySelector('#catalog-table tbody');
    listBody.innerHTML = '';
    
    let filtered = (state.db.catalog || []).filter(item => item !== null && item !== undefined);
    if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(item => 
            item.description.toLowerCase().includes(query) || 
            String(item.unitPrice).includes(query)
        );
    }

    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted);">ไม่พบรายการบริการ/สินค้าในแคตตาล็อก</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${item.description}</td>
            <td style="font-family: 'Inter', sans-serif; font-weight: 600;">฿${formatCurrency(item.unitPrice)}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick="openCatalogModal('${item.id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCatalogItem('${item.id}')"><i class="fas fa-trash"></i> ลบ</button>
                </div>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function openCatalogModal(id = null) {
    state.editingCatalogId = id;
    const modal = document.getElementById('catalog-modal');
    const form = document.getElementById('catalog-modal-form');
    const title = document.getElementById('catalog-modal-title');
    
    form.reset();
    
    if (id) {
        title.textContent = 'แก้ไขบริการ/สินค้า';
        const item = state.db.catalog.find(c => c.id === id);
        if (item) {
            document.getElementById('catalog-form-desc').value = item.description;
            document.getElementById('catalog-form-price').value = item.unitPrice;
        }
    } else {
        title.textContent = 'เพิ่มรายการบริการ/สินค้าใหม่';
    }
    
    modal.style.display = 'flex';
}

function closeCatalogModal() {
    document.getElementById('catalog-modal').style.display = 'none';
}

function saveCatalogForm() {
    const id = state.editingCatalogId;
    const description = document.getElementById('catalog-form-desc').value.trim();
    const unitPrice = parseFloat(document.getElementById('catalog-form-price').value) || 0;
    
    if (!description) {
        alert("กรุณากรอกรายละเอียดสินค้าหรือบริการ");
        return;
    }

    if (id) {
        const index = state.db.catalog.findIndex(c => c.id === id);
        if (index !== -1) {
            state.db.catalog[index] = { ...state.db.catalog[index], description, unitPrice };
        }
    } else {
        const newItem = {
            id: 'cat-' + Date.now(),
            description, unitPrice
        };
        state.db.catalog.push(newItem);
    }
    
    saveDB();
    closeCatalogModal();
    renderCatalog();
}

function deleteCatalogItem(id) {
    const item = state.db.catalog.find(c => c.id === id);
    if (!item) return;
    
    if (confirm(`คุณต้องการลบรายการ "${item.description}" หรือไม่?`)) {
        state.db.catalog = state.db.catalog.filter(c => c.id !== id);
        saveDB();
        renderCatalog();
    }
}

/* ==========================================================================
   DOCUMENT GENERATOR & PIXEL-PERFECT PREVIEW
   ========================================================================== */
function initDocGeneratorPage() {
    // Document Type Change
    document.getElementById('editor-doc-type').addEventListener('change', (e) => {
        state.currentDoc.docType = e.target.value;
        state.currentDoc.docNo = generateDocumentNumber(e.target.value);
        document.getElementById('editor-doc-no').value = state.currentDoc.docNo;
        
        // Dynamically adjust default notes/deposit depending on docType
        if (e.target.value === 'receipt') {
            document.getElementById('editor-notes').value = "ได้รับชำระเงินเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ";
            state.currentDoc.depositNote = "ได้รับชำระเงินเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ";
            state.currentDoc.depositOption = 'none';
            state.currentDoc.depositAmount = 0;
        } else if (e.target.value === 'delivery') {
            document.getElementById('editor-notes').value = "ส่งมอบและติดตั้งสินค้าเสร็จสมบูรณ์เรียบร้อยแล้ว";
            state.currentDoc.depositNote = "ส่งมอบและติดตั้งสินค้าเสร็จสมบูรณ์เรียบร้อยแล้ว";
            state.currentDoc.depositOption = 'none';
            state.currentDoc.depositAmount = 0;
        } else {
            state.currentDoc.depositOption = 'none';
            state.currentDoc.depositAmount = 0;
            document.getElementById('editor-notes').value = "ชำระค่ามัดจำ 5,000 บาท ส่วนที่เหลือจ่ายวันติดตั้ง";
            state.currentDoc.depositNote = "ชำระค่ามัดจำ 5,000 บาท ส่วนที่เหลือจ่ายวันติดตั้ง";
        }
        
        // Update deposit option selector in the DOM
        document.getElementById('editor-deposit-option').value = state.currentDoc.depositOption;
        document.getElementById('editor-deposit-amount').value = state.currentDoc.depositAmount;
        document.getElementById('editor-deposit-amount-group').style.display = 'none';

        updateCalculationsAndPreview();
    });

    // Auto-generate doc no button
    document.getElementById('btn-regenerate-no').addEventListener('click', () => {
        state.currentDoc.docNo = generateDocumentNumber(state.currentDoc.docType);
        document.getElementById('editor-doc-no').value = state.currentDoc.docNo;
        updateCalculationsAndPreview();
    });

    // Field binding listeners
    const bindField = (elementId, stateField) => {
        document.getElementById(elementId).addEventListener('input', (e) => {
            state.currentDoc[stateField] = e.target.value;
            updateCalculationsAndPreview();
        });
    };
    
    bindField('editor-doc-no', 'docNo');
    bindField('editor-doc-date', 'date');
    bindField('editor-cust-name', 'customerName');
    bindField('editor-cust-taxid', 'customerTaxId');
    bindField('editor-cust-phone', 'customerPhone');
    bindField('editor-cust-address', 'customerAddress');
    bindField('editor-event-date', 'eventDate');
    bindField('editor-event-location', 'eventLocation');
    bindField('editor-notes', 'depositNote');
    
    // Tax Toggle
    document.getElementById('editor-has-tax').addEventListener('change', (e) => {
        state.currentDoc.hasTax = e.target.checked;
        updateCalculationsAndPreview();
    });

    // Bank Account Edit binding
    bindField('editor-bank-name', 'bankName');
    bindField('editor-bank-no', 'bankAccountNo');
    bindField('editor-bank-accname', 'bankAccountName');
    
    // Signatures binding
    bindField('editor-manager-name', 'managerName');
    bindField('editor-manager-pos', 'managerPosition');
    
    // PromptPay and QR Code bindings
    bindField('editor-promptpay-no', 'promptPayNo');
    setupQRUploadHandler('editor-qrcode-file', 'editor-qrcode-base64', 'editor-qrcode-preview-container', 'editor-qrcode-preview', (base64) => {
        state.currentDoc.qrCodeBase64 = base64;
        updateCalculationsAndPreview();
    });
    setupQRRemoveHandler('btn-remove-editor-qrcode', 'editor-qrcode-file', 'editor-qrcode-base64', 'editor-qrcode-preview-container', () => {
        state.currentDoc.qrCodeBase64 = '';
        updateCalculationsAndPreview();
    });

    // Deposit Option & Amount listeners
    document.getElementById('editor-deposit-option').addEventListener('change', (e) => {
        const val = e.target.value;
        state.currentDoc.depositOption = val;
        
        const amountGroup = document.getElementById('editor-deposit-amount-group');
        const amountInput = document.getElementById('editor-deposit-amount');
        
        if (val === 'none') {
            state.currentDoc.depositAmount = 0;
            amountGroup.style.display = 'none';
        } else if (val === '5000') {
            state.currentDoc.depositAmount = 5000;
            amountGroup.style.display = 'none';
        } else if (val === '10000') {
            state.currentDoc.depositAmount = 10000;
            amountGroup.style.display = 'none';
        } else if (val === 'custom') {
            amountGroup.style.display = 'block';
            state.currentDoc.depositAmount = parseFloat(amountInput.value) || 0;
        }
        
        autoGenerateDepositNote();
        updateCalculationsAndPreview();
    });

    document.getElementById('editor-deposit-amount').addEventListener('input', (e) => {
        if (state.currentDoc.depositOption === 'custom') {
            state.currentDoc.depositAmount = parseFloat(e.target.value) || 0;
            autoGenerateDepositNote();
            updateCalculationsAndPreview();
        }
    });

    // Add Item Row button
    document.getElementById('btn-add-item-row').addEventListener('click', () => {
        addItemRow();
    });

    // Customer Autocomplete Setup
    setupCustomerAutocomplete();

    // Editor Actions
    const btnResetDoc = document.getElementById('btn-reset-doc');
    if (btnResetDoc) {
        btnResetDoc.addEventListener('click', () => {
            resetDocEditorState();
            renderDocumentGenerator();
        });
    }

    document.getElementById('btn-save-doc').addEventListener('click', () => {
        saveDocumentToDB();
    });

    document.getElementById('btn-send-line-auto').addEventListener('click', () => {
        saveDocumentToDB(false); // Silent save
        sendDocumentToLineBot();
    });

    document.getElementById('btn-copy-img').addEventListener('click', () => {
        saveDocumentToDB(false); // Silent save
        copyPreviewImageToClipboard();
    });

    document.getElementById('btn-download-img').addEventListener('click', () => {
        saveDocumentToDB(false); // Silent save
        downloadPreviewImage();
    });

    document.getElementById('btn-print-doc').addEventListener('click', () => {
        // First save to make sure print captures current changes
        saveDocumentToDB(false); // Silent save without navigation
        window.print();
    });
}

function resetDocEditorState() {
    const settings = state.db.settings;
    
    state.currentDoc = {
        docType: 'quotation',
        docNo: generateDocumentNumber('quotation'),
        date: new Date().toISOString().substring(0, 10),
        customerId: '',
        customerName: '',
        customerTaxId: '',
        customerPhone: '',
        customerAddress: '',
        eventDate: '',
        eventLocation: '',
        items: [
            { description: 'บริการจัดดอกไม้และตกแต่งสถานที่', qty: 1, unitPrice: 15000 }
        ],
        discount: 0,
        depositOption: 'none',
        depositAmount: 0,
        depositNote: 'ชำระค่ามัดจำ 5,000 บาท ส่วนที่เหลือจ่ายวันติดตั้ง',
        hasTax: false,
        bankName: settings.bankName || 'กสิกรไทย',
        bankAccountNo: settings.bankAccountNo || '034-8-20289-8',
        bankAccountName: settings.bankAccountName || 'ธนากร แก้วไทรอินทร์',
        promptPayNo: settings.promptPayNo || '',
        qrCodeBase64: settings.qrCodeBase64 || '',
        managerName: settings.managerName || 'ธนภัทร ชัยบำรุง',
        managerPosition: settings.managerPosition || 'ผู้จัดการ'
    };
    
    state.editingDocId = null;
    
    // Reset editor action headers
    document.getElementById('generator-title').textContent = 'สร้างเอกสารใหม่';
}

function setupCustomerAutocomplete() {
    const input = document.getElementById('editor-cust-name');
    const container = document.getElementById('cust-autocomplete-container');
    
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.display = 'none';
    container.appendChild(dropdown);
    
    input.addEventListener('focus', showDropdown);
    input.addEventListener('input', showDropdown);
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    function showDropdown() {
        const query = input.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        
        let matches = state.db.customers;
        if (query !== '') {
            matches = matches.filter(c => c.name.toLowerCase().includes(query));
        }
        
        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        matches.forEach(c => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `<strong>${c.name}</strong> <span style="color: var(--text-muted); font-size:12px;">(${c.phone || ''})</span>`;
            item.addEventListener('click', () => {
                selectCustomer(c);
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(item);
        });
        
        dropdown.style.display = 'block';
    }
}

function selectCustomer(customer) {
    state.currentDoc.customerId = customer.id;
    state.currentDoc.customerName = customer.name;
    state.currentDoc.customerTaxId = customer.taxId || '';
    state.currentDoc.customerPhone = customer.phone || '';
    state.currentDoc.customerAddress = customer.address || '';
    
    // Only set event details if customer has defaults
    if (customer.defaultEventDate) state.currentDoc.eventDate = customer.defaultEventDate;
    if (customer.defaultEventLocation) state.currentDoc.eventLocation = customer.defaultEventLocation;
    
    // Fill values in form inputs
    document.getElementById('editor-cust-name').value = state.currentDoc.customerName;
    document.getElementById('editor-cust-taxid').value = state.currentDoc.customerTaxId;
    document.getElementById('editor-cust-phone').value = state.currentDoc.customerPhone;
    document.getElementById('editor-cust-address').value = state.currentDoc.customerAddress;
    document.getElementById('editor-event-date').value = state.currentDoc.eventDate;
    document.getElementById('editor-event-location').value = state.currentDoc.eventLocation;
    
    updateCalculationsAndPreview();
}

function renderDocumentGenerator() {
    // Set field values in editor inputs
    document.getElementById('editor-doc-type').value = state.currentDoc.docType;
    document.getElementById('editor-doc-no').value = state.currentDoc.docNo;
    document.getElementById('editor-doc-date').value = state.currentDoc.date;
    document.getElementById('editor-cust-name').value = state.currentDoc.customerName;
    document.getElementById('editor-cust-taxid').value = state.currentDoc.customerTaxId;
    document.getElementById('editor-cust-phone').value = state.currentDoc.customerPhone;
    document.getElementById('editor-cust-address').value = state.currentDoc.customerAddress;
    document.getElementById('editor-event-date').value = state.currentDoc.eventDate;
    document.getElementById('editor-event-location').value = state.currentDoc.eventLocation;
    document.getElementById('editor-notes').value = state.currentDoc.depositNote;
    document.getElementById('editor-discount').value = state.currentDoc.discount;
    document.getElementById('editor-has-tax').checked = state.currentDoc.hasTax;
    
    // Populate deposit inputs
    const opt = state.currentDoc.depositOption || 'none';
    document.getElementById('editor-deposit-option').value = opt;
    document.getElementById('editor-deposit-amount').value = state.currentDoc.depositAmount || 0;
    document.getElementById('editor-deposit-amount-group').style.display = opt === 'custom' ? 'block' : 'none';
    
    document.getElementById('editor-bank-name').value = state.currentDoc.bankName;
    document.getElementById('editor-bank-no').value = state.currentDoc.bankAccountNo;
    document.getElementById('editor-bank-accname').value = state.currentDoc.bankAccountName;
    
    document.getElementById('editor-promptpay-no').value = state.currentDoc.promptPayNo || '';
    document.getElementById('editor-qrcode-base64').value = state.currentDoc.qrCodeBase64 || '';
    if (state.currentDoc.qrCodeBase64) {
        document.getElementById('editor-qrcode-preview').src = state.currentDoc.qrCodeBase64;
        document.getElementById('editor-qrcode-preview-container').style.display = 'flex';
    } else {
        document.getElementById('editor-qrcode-preview-container').style.display = 'none';
        document.getElementById('editor-qrcode-preview').src = '';
    }
    
    // Clear the file input so it doesn't display the previous filename
    const qrcodeFileInput = document.getElementById('editor-qrcode-file');
    if (qrcodeFileInput) qrcodeFileInput.value = '';
    
    document.getElementById('editor-manager-name').value = state.currentDoc.managerName;
    document.getElementById('editor-manager-pos').value = state.currentDoc.managerPosition;

    // Show/hide LINE Auto send button depending on whether token is configured
    const lineBtn = document.getElementById('btn-send-line-auto');
    if (lineBtn) {
        if (state.db.settings.lineChannelAccessToken && state.db.settings.lineUserId && state.db.settings.googleSheetsUrl) {
            lineBtn.style.display = 'inline-block';
        } else {
            lineBtn.style.display = 'none';
        }
    }

    renderItemEditorRows();
    updateCalculationsAndPreview();
}

function renderItemEditorRows() {
    const list = document.getElementById('editor-items-list');
    list.innerHTML = '';
    
    state.currentDoc.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center" data-label="ลำดับ" style="font-family: 'Inter', sans-serif;">${index + 1}</td>
            <td class="autocomplete-container" data-label="รายการ" style="position: relative;">
                <input type="text" class="form-control item-desc-input" value="${item.description}" placeholder="รายละเอียดสินค้า/บริการ" data-index="${index}">
                <div class="autocomplete-dropdown catalog-dropdown" style="display:none; width: 300px; left: 0;"></div>
            </td>
            <td data-label="จำนวน">
                <input type="number" class="form-control text-center item-qty-input" value="${item.qty}" min="1" data-index="${index}" style="width: 70px; font-family: 'Inter', sans-serif;">
            </td>
            <td data-label="ราคา/หน่วย">
                <input type="number" class="form-control text-right item-price-input" value="${item.unitPrice}" min="0" step="100" data-index="${index}" style="width: 110px; font-family: 'Inter', sans-serif;">
            </td>
            <td class="text-right" data-label="ราคารวม" style="font-family: 'Inter', sans-serif; font-weight: 600; padding-right:12px;">
                ฿${formatCurrency(item.qty * item.unitPrice)}
            </td>
            <td data-label="จัดการ">
                <div style="display:flex; gap: 4px;">
                    <button class="btn btn-secondary btn-sm" onclick="moveItemRow(${index}, -1)" style="padding: 4px 8px;" title="เลื่อนขึ้น"><i class="fas fa-chevron-up"></i></button>
                    <button class="btn btn-secondary btn-sm" onclick="moveItemRow(${index}, 1)" style="padding: 4px 8px;" title="เลื่อนลง"><i class="fas fa-chevron-down"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="removeItemRow(${index})" style="padding: 4px 8px;" title="ลบ"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;
        
        list.appendChild(tr);
        
        // Add Autocomplete logic for catalog
        setupCatalogAutocomplete(tr.querySelector('.item-desc-input'), tr.querySelector('.catalog-dropdown'), index);
    });

    // Set listener for discount separately (since it can trigger rerender)
    document.getElementById('editor-discount').addEventListener('input', (e) => {
        state.currentDoc.discount = parseFloat(e.target.value) || 0;
        updateCalculationsAndPreview();
    });
}

function setupCatalogAutocomplete(input, dropdown, rowIndex) {
    input.addEventListener('focus', showDropdown);
    input.addEventListener('input', showDropdown);
    
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    function showDropdown() {
        const query = input.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        
        let matches = state.db.catalog;
        if (query !== '') {
            matches = matches.filter(item => item.description.toLowerCase().includes(query));
        }
        
        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        matches.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `<strong>${item.description}</strong> <span style="float:right; color:#10b981; font-weight:600;">฿${formatCurrency(item.unitPrice)}</span>`;
            div.addEventListener('click', () => {
                state.currentDoc.items[rowIndex].description = item.description;
                state.currentDoc.items[rowIndex].unitPrice = item.unitPrice;
                input.value = item.description;
                
                // Refresh list and previews
                renderItemEditorRows();
                updateCalculationsAndPreview();
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(div);
        });
        
        dropdown.style.display = 'block';
    }

    // Manual input binding updates
    input.addEventListener('change', (e) => {
        state.currentDoc.items[rowIndex].description = e.target.value;
        updateCalculationsAndPreview();
    });

    const qtyInput = input.closest('tr').querySelector('.item-qty-input');
    qtyInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 1;
        state.currentDoc.items[rowIndex].qty = val;
        // update subtotal cell directly in DOM to avoid resetting focus while typing
        const totalCell = input.closest('tr').querySelector('td:nth-child(5)');
        totalCell.textContent = `฿${formatCurrency(val * state.currentDoc.items[rowIndex].unitPrice)}`;
        updateCalculationsAndPreview();
    });

    const priceInput = input.closest('tr').querySelector('.item-price-input');
    priceInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        state.currentDoc.items[rowIndex].unitPrice = val;
        const totalCell = input.closest('tr').querySelector('td:nth-child(5)');
        totalCell.textContent = `฿${formatCurrency(state.currentDoc.items[rowIndex].qty * val)}`;
        updateCalculationsAndPreview();
    });
}

function addItemRow() {
    state.currentDoc.items.push({ description: '', qty: 1, unitPrice: 0 });
    renderItemEditorRows();
    updateCalculationsAndPreview();
}

function removeItemRow(index) {
    state.currentDoc.items.splice(index, 1);
    renderItemEditorRows();
    updateCalculationsAndPreview();
}

function moveItemRow(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= state.currentDoc.items.length) return;
    
    // Swap items
    const temp = state.currentDoc.items[index];
    state.currentDoc.items[index] = state.currentDoc.items[targetIndex];
    state.currentDoc.items[targetIndex] = temp;
    
    renderItemEditorRows();
    updateCalculationsAndPreview();
}

function autoGenerateDepositNote() {
    const doc = state.currentDoc;
    const opt = doc.depositOption || 'none';
    const amt = doc.depositAmount || 0;
    
    if (doc.docType !== 'quotation') {
        return; // Only auto-generate notes for Quotations
    }
    
    if (opt === 'none' || amt === 0) {
        doc.depositNote = "ชำระค่ามัดจำ 5,000 บาท ส่วนที่เหลือจ่ายวันติดตั้ง";
        document.getElementById('editor-notes').value = doc.depositNote;
        return;
    }
    
    // Calculate balance
    const balance = doc.grandTotal - amt;
    const formattedAmt = formatCurrency(amt);
    const formattedBalance = formatCurrency(Math.max(0, balance));
    
    const note = `ชำระมัดจำ ${formattedAmt} บาท ส่วนที่เหลือจำนวน ${formattedBalance} บาท ชำระ ณ วันติดตั้ง`;
    doc.depositNote = note;
    document.getElementById('editor-notes').value = note;
}

function updateCalculationsAndPreview() {
    const doc = state.currentDoc;
    
    // 1. Math calculation
    let subtotal = 0;
    doc.items.forEach(item => {
        subtotal += (item.qty || 1) * (item.unitPrice || 0);
    });
    
    doc.subtotal = subtotal;
    
    let grandTotal = subtotal - (doc.discount || 0);
    let taxAmount = 0;
    
    if (doc.hasTax) {
        // Calculate VAT 7%
        taxAmount = grandTotal * 0.07;
        grandTotal += taxAmount;
    }
    
    doc.taxAmount = taxAmount;
    doc.grandTotal = Math.max(0, grandTotal);
    
    // Auto-update deposit note if a deposit option is active
    if (doc.depositOption && doc.depositOption !== 'none') {
        autoGenerateDepositNote();
    }
    
    // Convert grand total to Thai word representation (using our thaiBaht helper)
    let thaiText = 'ศูนย์บาทถ้วน';
    if (typeof thaiBaht === 'function') {
        thaiText = thaiBaht(doc.grandTotal);
    }
    doc.grandTotalThai = thaiText;

    // 2. Render in A4 Document Preview
    renderA4Preview();
}

function renderA4Preview() {
    const doc = state.currentDoc;
    const settings = state.db.settings;
    
    // Set document main class for proper layout themes
    const previewContainer = document.getElementById('a4-preview-document');
    previewContainer.className = `a4-document type-${doc.docType}`;
    
    // Determine headers based on type
    const typeTitles = {
        quotation: { th: 'ใบเสนอราคา', en: 'Quotation' },
        receipt: { th: 'ใบเสร็จรับเงิน', en: 'Receipt' },
        delivery: { th: 'ใบส่งสินค้า / ใบแจ้งหนี้', en: 'Delivery Order / Invoice' }
    };
    const titles = typeTitles[doc.docType] || typeTitles.quotation;
    
    document.getElementById('p-doc-title-th').textContent = titles.th;
    document.getElementById('p-doc-title-en').textContent = titles.en;
    
    // Company Header
    document.getElementById('p-comp-name').textContent = settings.companyName;
    document.getElementById('p-comp-addr').textContent = settings.address;
    document.getElementById('p-comp-taxid').textContent = settings.taxId;
    document.getElementById('p-comp-phone').textContent = settings.phones;
    document.getElementById('p-comp-email').textContent = settings.email;
    
    // Doc details
    const labelPrefixes = { quotation: 'เลขที่ใบเสนอราคา', receipt: 'เลขที่ใบเสร็จรับเงิน', delivery: 'เลขที่ใบส่งสินค้า' };
    document.getElementById('p-doc-no-label').textContent = `${labelPrefixes[doc.docType] || 'เลขที่เอกสาร'} :`;
    document.getElementById('p-doc-no').textContent = doc.docNo;
    document.getElementById('p-doc-date').textContent = parseThaiDate(doc.date);
    
    // Customer details
    document.getElementById('p-cust-name').textContent = doc.customerName || '-';
    document.getElementById('p-cust-taxid').textContent = doc.customerTaxId || '-';
    document.getElementById('p-cust-phone').textContent = doc.customerPhone || '-';
    document.getElementById('p-cust-addr').textContent = doc.customerAddress || '-';
    
    // Event details (Conditional display or '-' if empty)
    document.getElementById('p-event-date').textContent = parseThaiDate(doc.eventDate) || '-';
    document.getElementById('p-event-location').textContent = doc.eventLocation || '-';

    // Render Preview Table
    const tableBody = document.querySelector('#a4-items-table tbody');
    tableBody.innerHTML = '';
    
    if (doc.items.length === 0 || (doc.items.length === 1 && doc.items[0].description === '')) {
        // Render 1 empty dummy row
        tableBody.innerHTML = `
            <tr>
                <td class="col-index"></td>
                <td class="col-desc">-</td>
                <td class="col-qty">-</td>
                <td class="col-price">-</td>
                <td class="col-total">-</td>
            </tr>
        `;
    } else {
        doc.items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-index">${index + 1}</td>
                <td class="col-desc">${item.description || '-'}</td>
                <td class="col-qty">${item.qty || 1}</td>
                <td class="col-price">${formatCurrency(item.unitPrice || 0)}</td>
                <td class="col-total">${formatCurrency((item.qty || 1) * (item.unitPrice || 0))}</td>
            `;
            tableBody.appendChild(tr);
        });
        
        // Pad table with empty rows to match full-page aesthetic if short
        const minRows = 8;
        if (doc.items.length < minRows) {
            for (let i = doc.items.length; i < minRows; i++) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="col-index"></td>
                    <td class="col-desc" style="color:transparent;">-</td>
                    <td class="col-qty"></td>
                    <td class="col-price"></td>
                    <td class="col-total"></td>
                `;
                tableBody.appendChild(tr);
            }
        }
    }

    // Calculations display
    document.getElementById('p-subtotal').textContent = formatCurrency(doc.subtotal);
    
    const discountRow = document.getElementById('p-discount-row');
    if (doc.discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('p-discount').textContent = formatCurrency(doc.discount);
    } else {
        discountRow.style.display = 'none';
    }
    
    const taxRow = document.getElementById('p-tax-row');
    if (doc.hasTax) {
        taxRow.style.display = 'flex';
        document.getElementById('p-tax').textContent = formatCurrency(doc.taxAmount);
    } else {
        taxRow.style.display = 'none';
    }
    
    document.getElementById('p-grand-total-thai').textContent = doc.grandTotalThai;
    document.getElementById('p-grand-total').textContent = `฿ ${formatCurrency(doc.grandTotal)}`;

    // Render Deposit Info in A4
    const depositContainer = document.getElementById('p-deposit-info-container');
    const depositAmountSpan = document.getElementById('p-deposit-amount');
    const balanceAmountSpan = document.getElementById('p-balance-amount');
    
    if (doc.docType === 'quotation' && doc.depositAmount > 0) {
        depositContainer.style.display = 'block';
        depositAmountSpan.textContent = `฿ ${formatCurrency(doc.depositAmount)}`;
        
        const balance = Math.max(0, doc.grandTotal - doc.depositAmount);
        balanceAmountSpan.textContent = `฿ ${formatCurrency(balance)}`;
    } else {
        depositContainer.style.display = 'none';
    }

    // Notes
    document.getElementById('p-notes-content').textContent = doc.depositNote || '-';

    // Payment Info
    const paymentInfoBlock = document.getElementById('p-payment-info');
    if (doc.docType === 'receipt' || doc.docType === 'delivery') {
        paymentInfoBlock.style.display = 'none';
    } else {
        paymentInfoBlock.style.display = 'block';
        document.getElementById('p-bank-name').textContent = doc.bankName || '-';
        document.getElementById('p-bank-no').textContent = doc.bankAccountNo || '-';
        document.getElementById('p-bank-accname').textContent = doc.bankAccountName || '-';
        
        // Render PromptPay
        const promptpayRow = document.getElementById('p-promptpay-row');
        const promptpayNoSpan = document.getElementById('p-promptpay-no');
        if (doc.promptPayNo) {
            promptpayRow.style.display = 'flex';
            promptpayNoSpan.textContent = doc.promptPayNo;
        } else {
            promptpayRow.style.display = 'none';
        }
        
        // Render QR Code Image
        const qrcodeContainer = document.getElementById('p-qrcode-container');
        const qrcodeImg = document.getElementById('p-qrcode-img');
        if (doc.qrCodeBase64) {
            qrcodeContainer.style.display = 'block';
            qrcodeImg.src = doc.qrCodeBase64;
        } else if (doc.promptPayNo) {
            // Auto generate QR code via promptpay.io API
            const cleanPromptpay = doc.promptPayNo.replace(/[^0-9]/g, '');
            const amount = doc.grandTotal || 0;
            qrcodeContainer.style.display = 'block';
            qrcodeImg.src = amount > 0 
                ? `https://promptpay.io/${cleanPromptpay}/${amount}.png` 
                : `https://promptpay.io/${cleanPromptpay}.png`;
        } else {
            qrcodeContainer.style.display = 'none';
            qrcodeImg.src = '';
        }
    }

    // Signature Area adjustments based on type
    const sigTitleElement = document.getElementById('p-sig-title');
    const sigNameElement = document.getElementById('p-sig-name');
    
    if (doc.docType === 'quotation') {
        sigTitleElement.textContent = doc.managerPosition || 'ผู้จัดการ';
        sigNameElement.textContent = doc.managerName || 'ธนภัทร ชัยบำรุง';
    } else if (doc.docType === 'receipt') {
        sigTitleElement.textContent = 'ผู้รับเงิน';
        sigNameElement.textContent = doc.managerName || 'ธนภัทร ชัยบำรุง';
    } else if (doc.docType === 'delivery') {
        sigTitleElement.textContent = 'ผู้ส่งสินค้า / ผู้ติดตั้ง';
        sigNameElement.textContent = doc.managerName || 'ธนภัทร ชัยบำรุง';
    }
    
    // Render Signature Date
    const sigDateSpan = document.getElementById('p-sig-date');
    if (sigDateSpan) {
        sigDateSpan.textContent = parseThaiDate(doc.date) || '-';
    }
}

function saveDocumentToDB(showSuccessMessage = true) {
    const doc = state.currentDoc;
    
    if (!doc.customerName) {
        alert("กรุณากรอกชื่อลูกค้า");
        return;
    }
    
    if (doc.items.length === 0) {
        alert("กรุณาเพิ่มรายการสินค้าหรือบริการอย่างน้อย 1 รายการ");
        return;
    }

    // Auto-save or update customer in customer list
    if (doc.customerName) {
        let customer = state.db.customers.find(c => c.id === doc.customerId);
        if (!customer) {
            customer = state.db.customers.find(c => c.name.trim().toLowerCase() === doc.customerName.trim().toLowerCase());
        }

        const customerData = {
            id: customer ? customer.id : 'cust-' + Date.now(),
            name: doc.customerName.trim(),
            taxId: doc.customerTaxId ? doc.customerTaxId.trim() : '',
            phone: doc.customerPhone ? doc.customerPhone.trim() : '',
            address: doc.customerAddress ? doc.customerAddress.trim() : '',
            defaultEventDate: doc.eventDate || '',
            defaultEventLocation: doc.eventLocation ? doc.eventLocation.trim() : ''
        };

        if (customer) {
            const index = state.db.customers.findIndex(c => c.id === customer.id);
            if (index !== -1) {
                state.db.customers[index] = customerData;
            }
        } else {
            state.db.customers.push(customerData);
        }
        
        // Update current doc customerId to ensure it matches
        doc.customerId = customerData.id;
    }

    const docToSave = {
        ...doc,
        id: state.editingDocId || 'doc-' + Date.now(),
        updatedAt: new Date().toISOString(),
        createdAt: doc.createdAt || new Date().toISOString(),
        status: doc.status || 'draft'
    };

    if (state.editingDocId) {
        // Edit mode
        const index = state.db.documents.findIndex(d => d.id === state.editingDocId);
        if (index !== -1) {
            state.db.documents[index] = docToSave;
        }
    } else {
        // New mode
        state.db.documents.push(docToSave);
        state.editingDocId = docToSave.id; // Switch editor to edit mode for this item
    }

    saveDB(true); // Save and sync immediately
    
    // Update action title
    document.getElementById('generator-title').textContent = 'แก้ไขเอกสาร';

    if (showSuccessMessage) {
        alert(`บันทึก ${doc.docType === 'quotation' ? 'ใบเสนอราคา' : doc.docType === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบส่งสินค้า'} เรียบร้อยแล้ว!`);
        navigate('doc-history');
    }
}

function editExistingDocument(docId) {
    const doc = state.db.documents.find(d => d.id === docId);
    if (!doc) return;
    
    // Deep copy document values to state.currentDoc
    state.currentDoc = JSON.parse(JSON.stringify(doc));
    state.editingDocId = doc.id;
    
    navigate('doc-generator');
    document.getElementById('generator-title').textContent = 'แก้ไขเอกสาร';
}

/* ==========================================================================
   DOCUMENT HISTORY SECTION
   ========================================================================== */
function initDocHistoryPage() {
    // Filtering clicks
    const filterButtons = document.querySelectorAll('.history-filter');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDocumentHistory();
        });
    });

    // Export Excel CSV button
    document.getElementById('btn-export-history-csv').addEventListener('click', () => {
        exportHistoryToCSV();
    });

    // Search binding
    document.getElementById('history-search').addEventListener('input', () => {
        renderDocumentHistory();
    });
}

function renderDocumentHistory() {
    const listBody = document.querySelector('#history-table tbody');
    listBody.innerHTML = '';

    // Determine current filter type
    const activeFilterBtn = document.querySelector('.history-filter.active');
    const filterType = activeFilterBtn.getAttribute('data-filter'); // 'all' | 'quotation' | 'receipt' | 'delivery'
    const searchQuery = document.getElementById('history-search').value.toLowerCase().trim();

    let filtered = (state.db.documents || []).filter(doc => doc !== null && doc !== undefined);
    
    if (filterType !== 'all') {
        filtered = filtered.filter(doc => doc.docType === filterType);
    }
    
    if (searchQuery !== '') {
        filtered = filtered.filter(doc => 
            doc.docNo.toLowerCase().includes(searchQuery) ||
            doc.customerName.toLowerCase().includes(searchQuery) ||
            (doc.eventLocation && doc.eventLocation.toLowerCase().includes(searchQuery))
        );
    }

    // Sort descending by date
    filtered.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--text-muted);">ไม่พบข้อมูลประวัติเอกสาร</td></tr>`;
        return;
    }

    const typeLabels = { quotation: 'ใบเสนอราคา', receipt: 'ใบเสร็จรับเงิน', delivery: 'ใบส่งสินค้า' };
    const statusLabels = { draft: 'แบบร่าง', sent: 'ส่งเอกสารแล้ว', paid: 'ชำระเงินแล้ว', cancelled: 'ยกเลิก' };

    filtered.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: 'Inter', sans-serif; font-weight: 600;">${doc.docNo}</td>
            <td><span class="badge badge-${doc.docType}">${typeLabels[doc.docType]}</span></td>
            <td style="font-weight: 600;">${doc.customerName}</td>
            <td>${parseThaiDate(doc.date)}</td>
            <td style="font-family: 'Inter', sans-serif; font-weight: 600;">฿${formatCurrency(doc.grandTotal)}</td>
            <td>
                <select class="form-control status-select" style="padding: 4px 8px; width: 120px; font-size:12px; height:auto;" data-id="${doc.id}">
                    <option value="draft" ${doc.status === 'draft' ? 'selected' : ''}>แบบร่าง</option>
                    <option value="sent" ${doc.status === 'sent' ? 'selected' : ''}>ส่งเอกสารแล้ว</option>
                    <option value="paid" ${doc.status === 'paid' ? 'selected' : ''}>ชำระเงินแล้ว</option>
                    <option value="cancelled" ${doc.status === 'cancelled' ? 'selected' : ''}>ยกเลิก</option>
                </select>
            </td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" onclick="editExistingDocument('${doc.id}')" title="แก้ไข"><i class="fas fa-edit"></i> แก้ไข</button>
                    <button class="btn btn-primary btn-sm" onclick="printDocFromHistory('${doc.id}')" title="พิมพ์/บันทึก PDF"><i class="fas fa-print"></i> พิมพ์</button>
                    
                    ${doc.docType === 'quotation' ? `
                        <button class="btn btn-secondary btn-sm" onclick="convertDoc('${doc.id}', 'delivery')" style="background-color: #f0fdfa; border-color: #99f6e4; color: #0d9488;" title="แปลงเป็นใบส่งสินค้า"><i class="fas fa-shipping-fast"></i> ใบส่งของ</button>
                        <button class="btn btn-secondary btn-sm" onclick="convertDoc('${doc.id}', 'receipt')" style="background-color: #f0f9ff; border-color: #bae6fd; color: #0284c7;" title="แปลงเป็นใบเสร็จรับเงิน"><i class="fas fa-receipt"></i> ใบเสร็จ</button>
                    ` : ''}
                    
                    <button class="btn btn-danger btn-sm" onclick="deleteDocument('${doc.id}')" title="ลบ"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;
        
        // Handle status change dropdown
        tr.querySelector('.status-select').addEventListener('change', (e) => {
            changeDocStatus(doc.id, e.target.value);
        });

        listBody.appendChild(tr);
    });
}

function changeDocStatus(docId, newStatus) {
    const docIndex = state.db.documents.findIndex(d => d.id === docId);
    if (docIndex !== -1) {
        state.db.documents[docIndex].status = newStatus;
        saveDB();
        renderDashboard(); // Update dashboard metrics
    }
}

function deleteDocument(docId) {
    const doc = state.db.documents.find(d => d.id === docId);
    if (!doc) return;
    
    if (confirm(`คุณต้องการลบเอกสารเลขที่ "${doc.docNo}" ใช่หรือไม่?`)) {
        state.db.documents = state.db.documents.filter(d => d.id !== docId);
        saveDB();
        renderDocumentHistory();
    }
}

function printDocFromHistory(docId) {
    const doc = state.db.documents.find(d => d.id === docId);
    if (!doc) return;
    
    // Load to editor state and sync calculations
    state.currentDoc = JSON.parse(JSON.stringify(doc));
    state.editingDocId = doc.id;
    
    // Navigate to generator page, wait a tiny bit to render, then call browser print
    navigate('doc-generator');
    
    setTimeout(() => {
        window.print();
    }, 150);
}

function convertDoc(docId, targetType) {
    const originalDoc = state.db.documents.find(d => d.id === docId);
    if (!originalDoc) return;
    
    const typeLabels = { receipt: 'ใบเสร็จรับเงิน', delivery: 'ใบส่งสินค้า' };
    const label = typeLabels[targetType] || 'เอกสารใหม่';
    
    if (confirm(`คุณต้องการแปลงใบเสนอราคาเลขที่ "${originalDoc.docNo}" เป็น "${label}" ใช่หรือไม่? (ข้อมูลสินค้า ลูกค้า และยอดรวมทั้งหมดจะถูกคัดลอกไปสร้างเอกสารใบใหม่)`)) {
        // Clone original doc
        const newDoc = JSON.parse(JSON.stringify(originalDoc));
        
        // Generate new fields
        newDoc.id = 'doc-' + Date.now();
        newDoc.docType = targetType;
        newDoc.docNo = generateDocumentNumber(targetType);
        newDoc.date = new Date().toISOString().substring(0, 10);
        newDoc.createdAt = new Date().toISOString();
        newDoc.updatedAt = new Date().toISOString();
        newDoc.status = 'draft'; // Reset status to draft for new doc
        
        // Set default notes based on targetType
        if (targetType === 'receipt') {
            newDoc.depositNote = "ได้รับชำระเงินเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ";
        } else if (targetType === 'delivery') {
            newDoc.depositNote = "ส่งมอบและติดตั้งสินค้าเสร็จสมบูรณ์เรียบร้อยแล้ว";
        }

        // Insert into database
        state.db.documents.push(newDoc);
        saveDB();
        
        // Load into editor state and navigate
        state.currentDoc = newDoc;
        state.editingDocId = newDoc.id;
        
        navigate('doc-generator');
        alert(`แปลงเป็น ${label} สำเร็จแล้ว! คุณสามารถแก้ไขเพิ่มเติมและสั่งพิมพ์ได้ในหน้านี้`);
    }
}

/* ==========================================================================
   SETTINGS SECTION
   ========================================================================== */
function initSettingsPage() {
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
    });
    
    setupQRUploadHandler('set-qrcode-file', 'set-qrcode-base64', 'set-qrcode-preview-container', 'set-qrcode-preview', (base64) => {
        state.db.settings.qrCodeBase64 = base64;
    });
    
    setupQRRemoveHandler('btn-remove-set-qrcode', 'set-qrcode-file', 'set-qrcode-base64', 'set-qrcode-preview-container', () => {
        state.db.settings.qrCodeBase64 = '';
    });

    document.getElementById('btn-export-db').addEventListener('click', exportDatabase);
    document.getElementById('btn-import-db').addEventListener('click', () => {
        document.getElementById('db-import-file').click();
    });
    document.getElementById('db-import-file').addEventListener('change', importDatabase);
    document.getElementById('btn-reset-db').addEventListener('click', resetDB);
    
    // Cloud Sync Now button
    document.getElementById('btn-sync-now').addEventListener('click', () => {
        if (!state.db.settings.googleSheetsUrl) {
            alert("กรุณากรอกลิงก์ Google Sheets Web App URL ในช่องการตั้งค่าก่อนกดซิงก์");
            return;
        }
        syncPullData(true);
    });
}

function renderSettings() {
    const s = state.db.settings;
    
    document.getElementById('set-comp-name').value = s.companyName || '';
    document.getElementById('set-comp-addr').value = s.address || '';
    document.getElementById('set-comp-taxid').value = s.taxId || '';
    document.getElementById('set-comp-phone').value = s.phones || '';
    document.getElementById('set-comp-email').value = s.email || '';
    
    document.getElementById('set-bank-name').value = s.bankName || '';
    document.getElementById('set-bank-no').value = s.bankAccountNo || '';
    document.getElementById('set-bank-accname').value = s.bankAccountName || '';
    
    document.getElementById('set-promptpay-no').value = s.promptPayNo || '';
    document.getElementById('set-qrcode-base64').value = s.qrCodeBase64 || '';
    if (s.qrCodeBase64) {
        document.getElementById('set-qrcode-preview').src = s.qrCodeBase64;
        document.getElementById('set-qrcode-preview-container').style.display = 'flex';
    } else {
        document.getElementById('set-qrcode-preview-container').style.display = 'none';
        document.getElementById('set-qrcode-preview').src = '';
    }
    
    document.getElementById('set-manager-name').value = s.managerName || '';
    document.getElementById('set-manager-pos').value = s.managerPosition || '';
    document.getElementById('set-sheets-url').value = s.googleSheetsUrl || '';
    document.getElementById('set-line-token').value = s.lineChannelAccessToken || '';
    document.getElementById('set-line-userid').value = s.lineUserId || '';
}

function saveSettings() {
    const s = state.db.settings;
    
    s.companyName = document.getElementById('set-comp-name').value.trim();
    s.address = document.getElementById('set-comp-addr').value.trim();
    s.taxId = document.getElementById('set-comp-taxid').value.trim();
    s.phones = document.getElementById('set-comp-phone').value.trim();
    s.email = document.getElementById('set-comp-email').value.trim();
    
    s.bankName = document.getElementById('set-bank-name').value.trim();
    s.bankAccountNo = document.getElementById('set-bank-no').value.trim();
    s.bankAccountName = document.getElementById('set-bank-accname').value.trim();
    
    s.promptPayNo = document.getElementById('set-promptpay-no').value.trim();
    s.qrCodeBase64 = document.getElementById('set-qrcode-base64').value;
    
    s.managerName = document.getElementById('set-manager-name').value.trim();
    s.managerPosition = document.getElementById('set-manager-pos').value.trim();
    s.googleSheetsUrl = document.getElementById('set-sheets-url').value.trim();
    s.lineChannelAccessToken = document.getElementById('set-line-token').value.trim();
    s.lineUserId = document.getElementById('set-line-userid').value.trim();
    
    saveDB();
    alert("บันทึกการตั้งค่าเริ่มต้นเรียบร้อยแล้ว!");
    renderDashboard();
}

/* Backup Import / Export */
function exportDatabase() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.db, null, 2));
    const downloadAnchor = document.createElement('a');
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `phatflowers_erp_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importDatabase(e) {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    
    if (!file) return;
    
    fileReader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // Basic structural validation
            if (importedData.settings && Array.isArray(importedData.customers) && Array.isArray(importedData.catalog) && Array.isArray(importedData.documents)) {
                if (confirm("ยืนยันการนำเข้าข้อมูล? การนำเข้าข้อมูลนี้จะลบข้อมูลปัจจุบันของคุณทั้งหมด!")) {
                    state.db = importedData;
                    saveDB();
                    alert("นำเข้าข้อมูลสำรองสำเร็จแล้ว!");
                    location.reload();
                }
            } else {
                alert("ไฟล์ข้อมูลสำรองไม่ถูกต้อง โครงสร้างข้อมูลไม่ครบถ้วน");
            }
        } catch (err) {
            alert("ไม่สามารถอ่านไฟล์ข้อมูลสำรองได้: " + err.message);
        }
    };
    
    fileReader.readAsText(file);
}
/* ==========================================================================
   GOOGLE SHEETS SYNC IMPLEMENTATION (Apps Script Web App Hooks)
   ========================================================================== */
function updateSyncStatus(status, text) {
    const statusDiv = document.getElementById('sync-status');
    const icon = document.getElementById('sync-icon');
    const label = document.getElementById('sync-text');
    
    if (!statusDiv || !icon || !label) return;
    
    label.textContent = text;
    
    if (status === 'connecting') {
        statusDiv.style.color = '#fef08a'; // Light Yellow
        icon.className = 'fa-solid fa-arrows-rotate fa-spin';
    } else if (status === 'success') {
        statusDiv.style.color = '#2dd4bf'; // Teal
        icon.className = 'fa-solid fa-cloud';
    } else if (status === 'error') {
        statusDiv.style.color = '#f87171'; // Red
        icon.className = 'fa-solid fa-triangle-exclamation';
    } else if (status === 'offline') {
        statusDiv.style.color = '#94a3b8'; // Slate
        icon.className = 'fa-solid fa-cloud';
    }
}

function syncPullData(showSuccessAlert = false) {
    const url = state.db.settings.googleSheetsUrl;
    if (!url) return;
    
    updateSyncStatus('connecting', 'กำลังดึงข้อมูลคลาวด์...');
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action: 'fetch' })
    })
    .then(response => response.json())
    .then(res => {
        if (res.status === 'success') {
            const data = res.result;
            
            if (data) {
                if (data.customers) state.db.customers = data.customers;
                if (data.catalog) state.db.catalog = data.catalog;
                if (data.documents) state.db.documents = data.documents;
                if (data.settings) {
                    const currentUrl = state.db.settings.googleSheetsUrl;
                    state.db.settings = { ...state.db.settings, ...data.settings };
                    state.db.settings.googleSheetsUrl = currentUrl;
                }
                
                localStorage.setItem('phatflowers_erp_db', JSON.stringify(state.db));
            }
            
            updateSyncStatus('success', 'เชื่อมต่อ Google Sheets แล้ว');
            navigate(state.activeTab);
            
            if (showSuccessAlert) {
                alert("ดึงข้อมูลล่าสุดจาก Google Sheets สำเร็จแล้ว!");
            }
        } else {
            console.error("Sync pull error response:", res.message);
            updateSyncStatus('error', 'ซิงก์ข้อมูลล้มเหลว');
        }
    })
    .catch(err => {
        console.error("Sync pull connection error:", err);
        updateSyncStatus('error', 'เชื่อมต่อคลาวด์ล้มเหลว');
    });
}

let syncTimeout = null;
function syncPushData(immediate = false) {
    const url = state.db.settings.googleSheetsUrl;
    if (!url) return;
    
    updateSyncStatus('connecting', 'กำลังซิงก์ขึ้นคลาวด์...');
    
    if (syncTimeout) clearTimeout(syncTimeout);
    
    const runSync = () => {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'syncAll',
                data: state.db
            })
        })
        .then(response => response.json())
        .then(res => {
            if (res.status === 'success') {
                updateSyncStatus('success', 'เชื่อมต่อ Google Sheets แล้ว');
            } else {
                console.error("Sync push error response:", res.message);
                updateSyncStatus('error', 'ซิงก์ขึ้นคลาวด์ล้มเหลว');
            }
        })
        .catch(err => {
            console.error("Sync push connection error:", err);
            updateSyncStatus('error', 'เชื่อมต่อคลาวด์ล้มเหลว');
        });
    };

    if (immediate) {
        runSync();
    } else {
        syncTimeout = setTimeout(runSync, 1200);
    }
}

/* ฟังก์ชันสำหรับเปิด-ปิดเมนูบนมือถือ */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
    }
}

/* ฟังก์ชันปิดเมนูมือถือ */
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    }
}

/* ==========================================================================
   QR CODE FILE UPLOADER & REMOVER UTILITIES
   ========================================================================== */
function setupQRUploadHandler(fileInputId, hiddenInputId, previewContainerId, previewImgId, onSaveCallback) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64 = event.target.result;
            document.getElementById(hiddenInputId).value = base64;
            
            const previewContainer = document.getElementById(previewContainerId);
            const previewImg = document.getElementById(previewImgId);
            previewImg.src = base64;
            previewContainer.style.display = 'flex';
            
            onSaveCallback(base64);
        };
        reader.readAsDataURL(file);
    });
}

function setupQRRemoveHandler(btnId, fileInputId, hiddenInputId, previewContainerId, onRemoveCallback) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
        document.getElementById(fileInputId).value = '';
        document.getElementById(hiddenInputId).value = '';
        document.getElementById(previewContainerId).style.display = 'none';
        onRemoveCallback();
    });
}

/* ==========================================================================
   IMAGE EXPORT UTILITIES (html2canvas to Clipboard/File)
   ========================================================================== */
function generatePreviewCanvas(callback) {
    const docElement = document.getElementById('a4-preview-document');
    if (!docElement) return;

    const opts = {
        useCORS: true, // Allow cross-origin images (like promptpay.io QR codes)
        scale: 2, // High-DPI crisp scale
        backgroundColor: '#ffffff',
        logging: false
    };

    html2canvas(docElement, opts).then(canvas => {
        callback(canvas);
    }).catch(err => {
        console.error("Error generating canvas:", err);
        alert("เกิดข้อผิดพลาดในการสร้างรูปภาพ: " + err.message);
    });
}

function copyPreviewImageToClipboard() {
    // Show user some visual feedback
    const btn = document.getElementById('btn-copy-img');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้างรูปภาพ...`;
    btn.disabled = true;

    generatePreviewCanvas(canvas => {
        canvas.toBlob(blob => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            if (!blob) {
                alert("ไม่สามารถสร้างไฟล์รูปภาพได้");
                return;
            }
            
            try {
                const item = new ClipboardItem({ "image/png": blob });
                navigator.clipboard.write([item]).then(() => {
                    alert("คัดลอกรูปภาพเอกสารเข้า Clipboard เรียบร้อยแล้ว! สามารถเปิดแชท LINE หรือกลุ่มลูกค้า แล้วกดวาง (Ctrl + V หรือกดค้างเพื่อวาง) ส่งรูปภาพได้ทันทีครับ");
                }).catch(err => {
                    console.error("Clipboard write error:", err);
                    alert("บราวเซอร์หรืออุปกรณ์เครื่องนี้ไม่รองรับการคัดลอกรูปภาพโดยตรง ระบบจะทำการดาวน์โหลดไฟล์รูปภาพแทนครับ");
                    downloadPreviewImage();
                });
            } catch (err) {
                console.error("ClipboardItem creation error:", err);
                alert("อุปกรณ์ของคุณไม่รองรับการคัดลอกรูปภาพโดยตรง ระบบจะดาวน์โหลดไฟล์รูปภาพแทนครับ");
                downloadPreviewImage();
            }
        }, 'image/png');
    });
}

function downloadPreviewImage() {
    const btn = document.getElementById('btn-download-img');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังดาวน์โหลด...`;
    btn.disabled = true;

    generatePreviewCanvas(canvas => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        const docNo = state.currentDoc.docNo || 'document';
        const docType = state.currentDoc.docType;
        const typeNames = { quotation: 'ใบเสนอราคา', receipt: 'ใบเสร็จรับเงิน', delivery: 'ใบส่งสินค้า' };
        const name = typeNames[docType] || 'เอกสาร';
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${name}_${docNo}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
}

function sendDocumentToLineBot() {
    const token = state.db.settings.lineChannelAccessToken;
    const toId = state.db.settings.lineUserId;
    const url = state.db.settings.googleSheetsUrl;
    
    if (!token || !toId || !url) {
        alert("กรุณาตั้งค่า LINE Token, User/Group ID และ Google Sheets Web App URL ในหน้าตั้งค่าก่อนใช้งานครับ");
        return;
    }
    
    const doc = state.currentDoc;
    const typeNames = { quotation: 'ใบเสนอราคา', receipt: 'ใบเสร็จรับเงิน', delivery: 'ใบส่งสินค้า' };
    const name = typeNames[doc.docType] || 'เอกสาร';
    const message = `🔔 แจ้งเตือนจาก PhatFlowers ERP\n\n📄 ส่งเอกสาร: ${name}\n🔢 เลขที่เอกสาร: ${doc.docNo}\n👤 คุณลูกค้า: ${doc.customerName || '-'}\n💰 ยอดเงินรวม: ฿${formatCurrency(doc.grandTotal)}\n📍 สถานที่: ${doc.eventLocation || '-'}\n📅 วันจัดงาน: ${parseThaiDate(doc.eventDate) || '-'}`;

    const btn = document.getElementById('btn-send-line-auto');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง LINE...`;
    btn.disabled = true;

    generatePreviewCanvas(canvas => {
        const base64Image = canvas.toDataURL('image/png');
        
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'sendLineMessage',
                data: {
                    token: token,
                    toId: toId,
                    message: message,
                    image: base64Image
                }
            })
        })
        .then(response => response.json())
        .then(res => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            if (res.status === 'success') {
                alert("ส่งไฟล์ภาพเอกสารเข้าห้องแชท LINE เรียบร้อยแล้ว!");
            } else {
                console.error("LINE Messaging API send error response:", res);
                alert("การส่ง LINE ล้มเหลว: " + (res.message || 'กรุณาตรวจสอบสิทธิ์การเขียนไฟล์โฟลเดอร์ Google Drive และ Token/User ID ของคุณ'));
            }
        })
        .catch(err => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            console.error("LINE Messaging API network error:", err);
            alert("ไม่สามารถติดต่อ Cloud App Script ได้: " + err.message);
        });
    });
}