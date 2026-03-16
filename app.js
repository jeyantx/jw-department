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
    'Br. Dominic', 'Br. Hari', 'Br. Inbaraj', 'Br. Jagadeesan', 'Br. Jeyant',
    'Br. Joseph', 'Br. Jotham', 'Br. Karuppusamy', 'Br. Muthumohan', 'Br. Pandian',
    'Br. Prabakar', 'Br. Praveen', 'Br. Prem', 'Br. Raja', 'Br. Rejikumar',
    'Br. Shadrach', 'Br. Sivakumar', 'Br. Sree Nithish', 'Br. Sreekanth',
    'Br. Srinivasan', 'Br. Stephen', 'Br. Thomas', 'Br. Ulaganathan',
    'Br. Vinu', 'Br. Vivin'
];

const CLEANING_GROUPS = [
    '-', 'Aadhanur', 'Urapakkam', 'Keerapakkam', 'Mahalakshmi Nagar', 'Madambakkam'
];

const ROLES = [
    { cat: 'sound', key: 'sound_mic', label: 'Audio Mixer', icon: 'ph-duotone ph-speaker-high' },
    { cat: 'sound', key: 'sound_media', label: 'Media & Zoom', icon: 'ph-duotone ph-monitor-play' },
    { cat: 'sound', key: 'mic_left', label: 'Mic Roving - Left / Stage', icon: 'ph-duotone ph-microphone' },
    { cat: 'sound', key: 'mic_right', label: 'Mic Roving - Right', icon: 'ph-duotone ph-microphone' },
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
    cleaning:  { label: 'Cleaning',  icon: 'ph-duotone ph-broom',               css: 'cat-cleaning' },
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
document.addEventListener('DOMContentLoaded', function() {
    initFirebase();
    var picker = document.getElementById('meetingDatePicker');
    picker.value = toISODate(new Date());
    document.getElementById('conflictToggle').addEventListener('change', runConflictCheck);
    loadSchedule();
});

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
    if (document.getElementById('conflictToggle').checked) runConflictCheck();
}

function removeMeeting(index) {
    meetings.splice(index, 1);
    render();
}

// ============================================================
// RENDER
// ============================================================
function render() {
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

    // Attach select listeners
    var selects = document.querySelectorAll('.schedule-table select');
    for (var s = 0; s < selects.length; s++) {
        selects[s].addEventListener('change', function() {
            updateSelectStyle(this);
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
    showToast('Cleared');
}

// ============================================================
// IMAGE EXPORT
// ============================================================
async function captureTable() {
    var w = document.querySelector('.table-wrapper');
    // Temporarily remove overflow hidden so full table is visible
    var origOverflow = w.style.overflow;
    w.style.overflow = 'visible';
    w.classList.add('export-mode');

    var table = document.querySelector('.schedule-table');
    var totalWidth = table.scrollWidth;
    var totalHeight = table.scrollHeight;

    var canvas = await html2canvas(w, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        scrollX: 0, scrollY: 0,
        width: totalWidth,
        height: totalHeight,
        windowWidth: totalWidth + 60,
    });

    w.classList.remove('export-mode');
    w.style.overflow = origOverflow;
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
// TOAST
// ============================================================
function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}
