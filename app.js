// ============================================================
// CONFIG
// ============================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCZyDDl4qlUAJ4COtJRSd6d5_pWA-I-G_E",
    authDomain: "todo-5fcdf.firebaseapp.com",
    projectId: "todo-5fcdf",
    storageBucket: "todo-5fcdf.firebasestorage.app",
    messagingSenderId: "493348371854",
    appId: "1:493348371854:web:0d09953c5881d3d0e4f8df"
};

const COLLECTION = 'sound_schedule';

const BROTHERS = [
    '-',
    'Br. Anand', 'Br. Ben Cyrus', 'Br. Bovaz', 'Br. Daniel', 'Br. Devakumar',
    'Br. Dominic', 'Br. Hari', 'Br. Inbaraj', 'Br. Jagan', 'Br. Jeyant',
    'Br. Joseph', 'Br. Jotham', 'Br. Karuppusamy', 'Br. Muthumohan', 'Br. Pandian',
    'Br. Prabakar', 'Br. Praveen', 'Br. Prem', 'Br. Raja', 'Br. Rejikumar',
    'Br. Shadrach', 'Br. Sivakumar', 'Br. Sree Nithish', 'Br. Sreekanth',
    'Br. Srinivasan', 'Br. Stephen', 'Br. Thomas', 'Br. Ulaganathan',
    'Br. Vinu', 'Br. Vivin'
];

const CLEANING_GROUPS = [
    '-', 'Aadhanur', 'Urapakkam', 'Keerapakkam', 'Mahalakshmi', 'Madambakkam'
];

const ROLES = [
    { cat: 'sound', key: 'sound_mic', label: 'Audio Mixer', icon: 'ph-duotone ph-faders' },
    { cat: 'sound', key: 'sound_media', label: 'Media & Zoom', icon: 'ph-duotone ph-monitor-play' },
    { cat: 'sound', key: 'mic_left', label: 'Mic - Left / Stage', icon: 'ph-duotone ph-microphone' },
    { cat: 'sound', key: 'mic_right', label: 'Mic - Right', icon: 'ph-duotone ph-microphone' },
    { cat: 'attendant', key: 'att_hall', label: 'Hall', icon: 'ph-duotone ph-buildings' },
    { cat: 'attendant', key: 'att_entrance', label: 'Entrance', icon: 'ph-duotone ph-door' },
    { cat: 'attendant', key: 'att_parking', label: 'Parking', icon: 'ph-duotone ph-car' },
];

const CLEANING_ROLES = [
    { key: 'clean_broom', label: 'Brooming & Toilet', icon: 'ph-duotone ph-broom' },
    { key: 'clean_mop', label: 'Mopping & Stage', icon: 'ph-duotone ph-drop' },
];

const CATEGORIES = {
    sound:     { label: 'Sound',     icon: 'ph-duotone ph-speaker-high',         css: 'cat-sound' },
    attendant: { label: 'Attendant', icon: 'ph-duotone ph-identification-badge', css: 'cat-attendant' },
    cleaning:  { label: 'Cleaning',  icon: 'ph-duotone ph-sparkle',             css: 'cat-cleaning' },
};

var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================
// STATE
// ============================================================
var db = null;
var meetings = [];

// ============================================================
// INIT
// ============================================================
function initApp() {
    initFirebase();
    var picker = document.getElementById('meetingDatePicker');
    picker.value = toISODate(new Date());
    document.getElementById('conflictToggle').addEventListener('change', runConflictCheck);
    loadSchedule();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initFirebase() {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
}

// ============================================================
// DATE HELPERS
// ============================================================
function toISODate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function parseDate(str) {
    var parts = str.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function isMidweek(d) {
    return d.getDay() !== 0 && d.getDay() !== 6;
}

// ============================================================
// MEETING MANAGEMENT
// ============================================================
function addMeetingFromPicker() {
    var picker = document.getElementById('meetingDatePicker');
    if (!picker.value) {
        showToast('Please select a date first');
        return;
    }

    if (meetings.length >= 8) {
        showToast('Maximum 8 meetings per schedule');
        return;
    }

    var date = parseDate(picker.value);

    // Check for duplicate
    var exists = meetings.some(function(m) { return toISODate(m) === toISODate(date); });
    if (exists) {
        showToast('This date is already added');
        return;
    }

    meetings.push(date);
    meetings.sort(function(a, b) { return a - b; });

    // Advance picker by 3-4 days
    var next = new Date(date);
    next.setDate(next.getDate() + (date.getDay() === 0 ? 3 : 4));
    picker.value = toISODate(next);

    render();
    markDirty();
    if (document.getElementById('conflictToggle').checked) runConflictCheck();
}

function removeMeeting(index) {
    meetings.splice(index, 1);
    render();
    markDirty();
}

// ============================================================
// RENDER
// ============================================================

// Save current dropdown values keyed by date string (not column index)
function gatherCurrentValues() {
    var saved = {};
    for (var ci = 0; ci < meetings.length; ci++) {
        var dateKey = toISODate(meetings[ci]);
        var col = {};
        var sels = document.querySelectorAll('select[data-col="' + ci + '"]');
        for (var s = 0; s < sels.length; s++) {
            col[sels[s].dataset.role] = sels[s].value;
        }
        saved[dateKey] = col;
    }
    return saved;
}

// Restore dropdown values after re-render using date keys
function restoreValues(saved) {
    for (var ci = 0; ci < meetings.length; ci++) {
        var dateKey = toISODate(meetings[ci]);
        var col = saved[dateKey];
        if (!col) continue;
        var keys = Object.keys(col);
        for (var k = 0; k < keys.length; k++) {
            var el = document.getElementById('sel_' + keys[k] + '_' + ci);
            if (el) { el.value = col[keys[k]]; updateSelectStyle(el); }
        }
    }
}

function render() {
    // Save existing values before re-rendering
    var saved = gatherCurrentValues();

    var wrapper = document.querySelector('.table-wrapper');
    var empty = document.getElementById('emptyState');

    if (meetings.length === 0) {
        wrapper.classList.remove('visible');
        empty.classList.remove('hidden');
        document.getElementById('tableHead').innerHTML = '';
        document.getElementById('tableBody').innerHTML = '';
        return;
    }

    wrapper.classList.add('visible');
    empty.classList.add('hidden');

    renderHead();
    renderBody();

    // Restore saved values
    restoreValues(saved);

    // Attach select listeners
    var selects = document.querySelectorAll('.schedule-table select');
    for (var s = 0; s < selects.length; s++) {
        selects[s].addEventListener('change', function() {
            updateSelectStyle(this);
            markDirty();
            if (document.getElementById('conflictToggle').checked) runConflictCheck();
        });
    }
}

function renderHead() {
    var html = '<tr>';
    html += '<th class="role-col">Role</th>';

    for (var i = 0; i < meetings.length; i++) {
        var d = meetings[i];
        var colClass = isMidweek(d) ? 'col-midweek' : 'col-weekend';
        html += '<th class="meeting-col ' + colClass + '">';
        html += '<div class="meeting-header">';
        html += DAY_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
        html += '</div>';
        html += '<button class="btn-remove-col no-print" onclick="removeMeeting(' + i + ')" title="Remove">';
        html += '<i class="ph-duotone ph-x-circle"></i> remove</button>';
        html += '</th>';
    }

    html += '</tr>';
    document.getElementById('tableHead').innerHTML = html;
}

function renderBody() {
    var n = meetings.length;
    var html = '';
    var lastCat = '';
    var emptyTds = '';
    for (var e = 0; e < n; e++) emptyTds += '<td></td>';

    for (var r = 0; r < ROLES.length; r++) {
        var role = ROLES[r];
        if (role.cat !== lastCat) {
            lastCat = role.cat;
            var c = CATEGORIES[role.cat];
            html += '<tr class="cat-header ' + c.css + '">';
            html += '<td><i class="' + c.icon + '"></i> ' + c.label + '</td>';
            html += emptyTds;
            html += '</tr>';
        }
        html += '<tr>';
        html += '<td class="role-label"><i class="' + role.icon + '"></i>' + role.label + '</td>';
        for (var i = 0; i < n; i++) {
            html += '<td>' + dropdown(role.key, i, BROTHERS) + '</td>';
        }
        html += '</tr>';
    }

    // Cleaning
    var cl = CATEGORIES.cleaning;
    html += '<tr class="cat-header ' + cl.css + '">';
    html += '<td><i class="' + cl.icon + '"></i> ' + cl.label + '</td>';
    html += emptyTds;
    html += '</tr>';

    for (var cr = 0; cr < CLEANING_ROLES.length; cr++) {
        var crole = CLEANING_ROLES[cr];
        html += '<tr>';
        html += '<td class="role-label"><i class="' + crole.icon + '"></i>' + crole.label + '</td>';
        for (var j = 0; j < n; j++) {
            html += '<td>' + dropdown(crole.key + '_grp', j, CLEANING_GROUPS) + '</td>';
        }
        html += '</tr>';
    }

    document.getElementById('tableBody').innerHTML = html;
}

function dropdown(roleKey, colIndex, options) {
    var id = 'sel_' + roleKey + '_' + colIndex;
    var html = '<select id="' + id + '" data-role="' + roleKey + '" data-col="' + colIndex + '">';
    for (var i = 0; i < options.length; i++) {
        html += '<option value="' + options[i] + '">' + options[i] + '</option>';
    }
    html += '</select>';
    return html;
}

function updateSelectStyle(sel) {
    if (sel.value && sel.value !== '-') {
        sel.classList.add('has-value');
    } else {
        sel.classList.remove('has-value');
    }
}

// ============================================================
// CONFLICT CHECK
// ============================================================
function runConflictCheck() {
    var old = document.querySelectorAll('.conflict-cell');
    for (var x = 0; x < old.length; x++) old[x].classList.remove('conflict-cell');
    var dots = document.querySelectorAll('.conflict-dot');
    for (var y = 0; y < dots.length; y++) dots[y].remove();

    if (!document.getElementById('conflictToggle').checked) return;

    for (var ci = 0; ci < meetings.length; ci++) {
        var map = {};
        var sels = document.querySelectorAll('select[data-col="' + ci + '"]');
        for (var s = 0; s < sels.length; s++) {
            var sel = sels[s];
            if (sel.value && sel.value !== '-' && sel.dataset.role.indexOf('_grp') === -1) {
                if (!map[sel.value]) map[sel.value] = [];
                map[sel.value].push(sel.closest('td'));
            }
        }

        var keys = Object.keys(map);
        for (var k = 0; k < keys.length; k++) {
            var cells = map[keys[k]];
            if (cells.length > 1) {
                for (var t = 0; t < cells.length; t++) {
                    var td = cells[t];
                    if (td) {
                        td.classList.add('conflict-cell');
                        if (!td.querySelector('.conflict-dot')) {
                            var dot = document.createElement('div');
                            dot.className = 'conflict-dot';
                            td.style.position = 'relative';
                            td.appendChild(dot);
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// FIREBASE
// ============================================================
function getDocId() {
    return 'current_schedule';
}

function gatherData() {
    var data = {
        meetingDates: meetings.map(toISODate),
        columns: {},
        updatedAt: new Date().toISOString()
    };

    for (var ci = 0; ci < meetings.length; ci++) {
        var col = {};
        for (var r = 0; r < ROLES.length; r++) {
            var el = document.getElementById('sel_' + ROLES[r].key + '_' + ci);
            if (el) col[ROLES[r].key] = el.value;
        }
        for (var cr = 0; cr < CLEANING_ROLES.length; cr++) {
            var g = document.getElementById('sel_' + CLEANING_ROLES[cr].key + '_grp_' + ci);
            if (g) col[CLEANING_ROLES[cr].key + '_grp'] = g.value;
        }
        data.columns['col_' + ci] = col;
    }

    return data;
}

async function saveSchedule() {
    if (!meetings.length) { showToast('Add at least one meeting'); return; }
    try {
        await db.collection(COLLECTION).doc(getDocId()).set(gatherData());
        hasUnsavedChanges = false;
        showToast('Schedule saved!');
    } catch (e) {
        console.error(e);
        showToast('Error saving');
    }
}

async function loadSchedule() {
    try {
        var doc = await db.collection(COLLECTION).doc(getDocId()).get();
        if (!doc.exists) {
            render();
            return;
        }
        var data = doc.data();

        // Restore meeting dates
        if (data.meetingDates && data.meetingDates.length > 0) {
            meetings = data.meetingDates.map(function(d) { return parseDate(d); });
        }

        // Render the table with restored meetings
        render();

        // Now populate the dropdowns with saved values
        if (data.columns) {
            for (var ci = 0; ci < meetings.length; ci++) {
                var col = data.columns['col_' + ci];
                if (!col) continue;
                var keys = Object.keys(col);
                for (var k = 0; k < keys.length; k++) {
                    var el = document.getElementById('sel_' + keys[k] + '_' + ci);
                    if (el) { el.value = col[keys[k]]; updateSelectStyle(el); }
                }
            }
        }

        showToast('Schedule loaded');
    } catch (e) {
        console.error(e);
        render();
    }
}

// ============================================================
// CLEAR
// ============================================================
function clearSchedule() {
    if (!confirm('Clear all assignments?')) return;
    var sels = document.querySelectorAll('.schedule-table select');
    for (var i = 0; i < sels.length; i++) {
        sels[i].value = '-';
        sels[i].classList.remove('has-value');
    }
    var conflicts = document.querySelectorAll('.conflict-cell');
    for (var j = 0; j < conflicts.length; j++) conflicts[j].classList.remove('conflict-cell');
    var dots = document.querySelectorAll('.conflict-dot');
    for (var k = 0; k < dots.length; k++) dots[k].remove();
    markDirty();
    showToast('Cleared');
}

// ============================================================
// IMAGE EXPORT — builds a print-styled static clone, same as PDF
// ============================================================
function buildPrintClone() {
    // Category color map (matches CSS)
    var catColors = {
        sound:     { bg: '#eff6ff', color: '#1d4ed8', border: '#2563eb' },
        attendant: { bg: '#fff7ed', color: '#c2410c', border: '#c2410c' },
        cleaning:  { bg: '#ecfdf5', color: '#047857', border: '#059669' }
    };
    var colColors = {
        midweek: { color: '#1e40af', border: '#2563eb' },
        weekend: { color: '#92400e', border: '#d97706' }
    };

    // Gather current select values
    var vals = {};
    var sels = document.querySelectorAll('.schedule-table select');
    for (var s = 0; s < sels.length; s++) {
        vals[sels[s].id] = sels[s].value;
    }

    // Container — A4 landscape proportions (297mm ≈ 1122px at 96dpi, scaled up for crisp export)
    var container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;background:#fff;padding:20px 24px;font-family:"Noto Sans",sans-serif;width:1400px;';
    document.body.appendChild(container);

    // Title
    var title = document.createElement('div');
    title.textContent = 'Urapakkam Congregation - Department Assignment';
    title.style.cssText = 'font-size:16pt;font-weight:900;color:#111827;padding:0 0 12px;border-bottom:3px solid #111827;margin-bottom:0;';
    container.appendChild(title);

    // Table
    var tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;border-left:3px solid #111827;border-right:3px solid #111827;';
    container.appendChild(tbl);

    // Role col width
    var numCols = meetings.length;
    var roleW = '18%';
    var colW = ((100 - 18) / numCols).toFixed(2) + '%';

    // Colgroup
    var colgroup = '<colgroup><col style="width:' + roleW + '">';
    for (var cg = 0; cg < numCols; cg++) colgroup += '<col style="width:' + colW + '">';
    colgroup += '</colgroup>';
    tbl.innerHTML = colgroup;

    // Thead
    var thead = document.createElement('thead');
    tbl.appendChild(thead);
    var hRow = document.createElement('tr');
    thead.appendChild(hRow);

    var th0 = document.createElement('th');
    th0.textContent = 'Role';
    th0.style.cssText = 'text-align:left;font-size:10pt;font-weight:800;padding:10px 8px;border-bottom:3px solid #111827;color:#111827;text-transform:uppercase;letter-spacing:0.5px;';
    hRow.appendChild(th0);

    for (var h = 0; h < numCols; h++) {
        var d = meetings[h];
        var isM = isMidweek(d);
        var cc = isM ? colColors.midweek : colColors.weekend;
        var th = document.createElement('th');
        th.textContent = DAY_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
        th.style.cssText = 'text-align:left;font-size:10pt;font-weight:800;padding:10px 8px;color:' + cc.color + ';border-bottom:3px solid ' + cc.border + ';';
        hRow.appendChild(th);
    }

    // Tbody
    var tbody = document.createElement('tbody');
    tbl.appendChild(tbody);

    var lastCat = '';
    var allRoles = ROLES.concat(CLEANING_ROLES.map(function(cr) {
        return { cat: 'cleaning', key: cr.key + '_grp', label: cr.label, icon: cr.icon };
    }));

    for (var r = 0; r < allRoles.length; r++) {
        var role = allRoles[r];

        // Category header row
        if (role.cat !== lastCat) {
            lastCat = role.cat;
            var catInfo = CATEGORIES[role.cat];
            var cc2 = catColors[role.cat];
            var catRow = document.createElement('tr');
            var catTd = document.createElement('td');
            catTd.colSpan = numCols + 1;
            catTd.textContent = catInfo.label.toUpperCase();
            catTd.style.cssText = 'font-size:10pt;font-weight:900;padding:10px 16px;background:' + cc2.bg + ';color:' + cc2.color + ';border-bottom:3px solid ' + cc2.border + ';letter-spacing:0.5px;';
            catRow.appendChild(catTd);
            tbody.appendChild(catRow);
        }

        // Data row
        var row = document.createElement('tr');
        var roleTd = document.createElement('td');
        roleTd.textContent = role.label;
        roleTd.style.cssText = 'font-size:10pt;font-weight:700;padding:10px 16px;color:#111827;border-bottom:1px solid #d1d5db;white-space:nowrap;';
        row.appendChild(roleTd);

        for (var ci = 0; ci < numCols; ci++) {
            var td = document.createElement('td');
            var selId = 'sel_' + role.key + '_' + ci;
            var val = vals[selId] || '-';
            td.textContent = (val && val !== '-') ? val : '';
            td.style.cssText = 'font-size:10pt;font-weight:600;padding:10px 8px;color:#111827;border-bottom:1px solid #d1d5db;white-space:nowrap;';
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }

    // Last row closing border
    var lastRow = tbody.lastChild;
    if (lastRow) {
        var lastCells = lastRow.querySelectorAll('td');
        for (var lc = 0; lc < lastCells.length; lc++) {
            lastCells[lc].style.borderBottom = '3px solid #1f2937';
        }
    }

    return container;
}

async function captureTable() {
    var clone = buildPrintClone();

    // Wait for fonts to render
    await new Promise(function(resolve) { setTimeout(resolve, 100); });

    var canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        scrollX: 0, scrollY: 0,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth + 60,
    });

    clone.remove();
    return canvas;
}

async function copyImage() {
    try {
        var c = await captureTable();
        c.toBlob(async function(blob) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Image copied!');
        });
    } catch (e) {
        console.error(e);
        showToast('Copy failed - try Download');
    }
}

async function downloadImage() {
    try {
        var c = await captureTable();
        var a = document.createElement('a');
        a.download = 'schedule-' + toISODate(new Date()) + '.png';
        a.href = c.toDataURL('image/png');
        a.click();
        showToast('Downloaded!');
    } catch (e) {
        console.error(e);
        showToast('Download failed');
    }
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    localStorage.removeItem('ss_auth');
    window.location.href = 'login.html';
}

// ============================================================
// HELP MODAL
// ============================================================
function showHelp() {
    document.getElementById('helpOverlay').classList.add('visible');
}

function closeHelp(e) {
    if (e.target === document.getElementById('helpOverlay')) {
        document.getElementById('helpOverlay').classList.remove('visible');
    }
}

// ============================================================
// UNSAVED CHANGES WARNING
// ============================================================
var hasUnsavedChanges = false;

function markDirty() {
    hasUnsavedChanges = true;
}

window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}
