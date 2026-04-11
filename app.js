// 7MPizza Floor Plan Reservation (client-side prototype)
// - Click tables/seats to select
// - Reserve => marked reserved (red)
// - Available => green
// - Selected => blue
// - LocalStorage persistence

const STORAGE_KEY = "sevenm_floorplan_reservations_v1";

const SPACE = {
  T1: { id:"T1", name:"Dining Table 1", cap:4, type:"table" },
  T2: { id:"T2", name:"Dining Table 2", cap:4, type:"table" },
  T3: { id:"T3", name:"Dining Table 3", cap:4, type:"table" },
  T4: { id:"T4", name:"Dining Table 4", cap:4, type:"table" },
  T5: { id:"T5", name:"Dining Table 5", cap:4, type:"table" },
  B1: { id:"B1", name:"Bar Seat 1", cap:1, type:"seat" },
  B2: { id:"B2", name:"Bar Seat 2", cap:1, type:"seat" },
  B3: { id:"B3", name:"Bar Seat 3", cap:1, type:"seat" },
  B4: { id:"B4", name:"Bar Seat 4", cap:1, type:"seat" },
};

const $ = (sel) => document.querySelector(sel);
const floor = $("#floor");
const selectedListEl = $("#selectedList");
const selectedMetaEl = $("#selectedMeta");
const hintEl = $("#hint");
const resListEl = $("#resList");

const modal = $("#modal");
const modalBody = $("#modalBody");
const closeModalBtn = $("#closeModal");
const cancelReservationBtn = $("#cancelReservation");

const form = $("#reserveForm");
const clearSelectionBtn = $("#clearSelection");
const clearAllBtn = $("#clearAll");

let reservations = loadReservations();
let selectedIds = new Set();
let openedReservationId = null;

function loadReservations(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}
function saveReservations(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

function sameSlot(a, b){
  return a.date === b.date && a.time === b.time;
}

function slotHasConflict(date, time, chosenSpaceIds){
  // Rule: only 1 reservation per time slot.
  // Meaning: if ANY reservation exists for that date+time (not cancelled), block.
  // If you want "per-table only" instead, tell me and I’ll change it.
  return reservations.some(r => r.status !== "Cancelled" && r.date === date && r.time === time);
}

function getCapacity(ids){
  let sum = 0;
  ids.forEach(id => sum += (SPACE[id]?.cap || 0));
  return sum;
}

function updateVisualStates(){
  // Reset all to available
  const nodes = floor.querySelectorAll("[data-id]");
  nodes.forEach(n => {
    n.classList.remove("selected","reserved","available");
    n.classList.add("available");
  });

  // Mark reserved (any table/seat that is in a non-cancelled reservation)
  const reservedIds = new Set();
  reservations
    .filter(r => r.status !== "Cancelled")
    .forEach(r => r.spaceIds.forEach(id => reservedIds.add(id)));

  nodes.forEach(n => {
    const id = n.dataset.id;
    if (reservedIds.has(id)){
      n.classList.remove("available","selected");
      n.classList.add("reserved");
      n.setAttribute("aria-disabled","true");
    } else {
      n.setAttribute("aria-disabled","false");
    }
  });

  // Mark selected (only if not reserved)
  selectedIds.forEach(id => {
    const node = floor.querySelector(`[data-id="${id}"]`);
    if (!node) return;
    if (node.classList.contains("reserved")) return;
    node.classList.remove("available");
    node.classList.add("selected");
  });
}

function updateSelectedSummary(){
  const ids = [...selectedIds];
  if (ids.length === 0){
    selectedListEl.textContent = "None";
    selectedMetaEl.textContent = "Total capacity: 0 pax";
    return;
  }
  selectedListEl.textContent = ids.join(", ");
  selectedMetaEl.textContent = `Total capacity: ${getCapacity(ids)} pax`;
}

function setHint(msg, type="muted"){
  hintEl.textContent = msg || "";
  if (type === "good") hintEl.style.color = "rgba(52,211,153,.95)";
  else if (type === "bad") hintEl.style.color = "rgba(251,113,133,.95)";
  else hintEl.style.color = "";
}

function renderReservationList(){
  resListEl.innerHTML = "";
  const sorted = [...reservations].sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  if (sorted.length === 0){
    resListEl.innerHTML = `<div class="hint">No reservations yet.</div>`;
    return;
  }

  sorted.slice(0, 12).forEach(r => {
    const div = document.createElement("div");
    div.className = "resItem";
    div.innerHTML = `
      <div class="top">
        <div><strong>${escapeHtml(r.name)}</strong></div>
        <span class="badge res">${r.status}</span>
      </div>
      <div class="meta">
        Slot: <strong>${r.date}</strong> at <strong>${r.time}</strong><br/>
        Pax: <strong>${r.pax}</strong> • Space: <strong>${r.spaceIds.join(", ")}</strong><br/>
        Contact: ${escapeHtml(r.contact)} ${r.notes ? "• Notes: " + escapeHtml(r.notes) : ""}
      </div>
      <div style="margin-top:10px;">
        <button class="btn small" data-view="${r.id}">View</button>
      </div>
    `;
    resListEl.appendChild(div);
  });

  resListEl.querySelectorAll("button[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.view;
      openReservationModal(id);
    });
  });
}

function openReservationModal(resId){
  const r = reservations.find(x => x.id === resId);
  if (!r) return;

  openedReservationId = resId;
  modalBody.innerHTML = `
    <div class="mrow"><strong>Name:</strong> ${escapeHtml(r.name)}</div>
    <div class="mrow"><strong>Contact:</strong> ${escapeHtml(r.contact)}</div>
    <div class="mrow"><strong>Date/Time:</strong> ${r.date} • ${r.time}</div>
    <div class="mrow"><strong>Pax:</strong> ${r.pax}</div>
    <div class="mrow"><strong>Reserved Space:</strong> ${r.spaceIds.join(", ")}</div>
    <div class="mrow"><strong>Status:</strong> ${r.status}</div>
    ${r.notes ? `<div class="mrow"><strong>Notes:</strong> ${escapeHtml(r.notes)}</div>` : ""}
  `;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
}

function closeModal(){
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
  openedReservationId = null;
}

closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

cancelReservationBtn.addEventListener("click", () => {
  if (!openedReservationId) return;
  const r = reservations.find(x => x.id === openedReservationId);
  if (!r) return;
  if (!confirm("Cancel this reservation?")) return;

  r.status = "Cancelled";
  saveReservations();
  updateVisualStates();
  renderReservationList();
  closeModal();
});

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Click handling (tables + seats)
floor.querySelectorAll("[data-id]").forEach(node => {
  node.addEventListener("click", () => {
    const id = node.dataset.id;

    // If reserved, show details (if exists)
    if (node.classList.contains("reserved")){
      const r = reservations.find(x => x.status !== "Cancelled" && x.spaceIds.includes(id));
      if (r) openReservationModal(r.id);
      return;
    }

    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);

    updateVisualStates();
    updateSelectedSummary();
    setHint("");
  });
});

clearSelectionBtn.addEventListener("click", () => {
  selectedIds.clear();
  updateVisualStates();
  updateSelectedSummary();
  setHint("");
});

clearAllBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL reservations? (demo only)")) return;
  reservations = [];
  saveReservations();
  selectedIds.clear();
  updateVisualStates();
  updateSelectedSummary();
  renderReservationList();
  setHint("All reservations cleared.", "good");
});

// Reservation submit
form.addEventListener("submit", (e) => {
  e.preventDefault();
  setHint("");

  const ids = [...selectedIds];
  if (ids.length === 0){
    setHint("Please select at least one table/seat.", "bad");
    return;
  }

  // if any selected is reserved, block
  const anyReserved = ids.some(id => {
    return reservations.some(r => r.status !== "Cancelled" && r.spaceIds.includes(id));
  });
  if (anyReserved){
    setHint("One of your selected tables is already reserved.", "bad");
    return;
  }

  const name = $("#name").value.trim();
  const contact = $("#contact").value.trim();
  const pax = Number($("#pax").value || 0);
  const date = $("#date").value;
  const time = $("#time").value;
  const notes = $("#notes").value.trim();

  if (!name || !contact || !date || !time || pax <= 0){
    setHint("Please complete all required fields.", "bad");
    return;
  }

  const cap = getCapacity(ids);
  if (pax > cap){
    setHint(`Pax (${pax}) exceeds selected capacity (${cap}). Select more tables or reduce pax.`, "bad");
    return;
  }

  // Only 1 reservation per time slot (global)
  if (slotHasConflict(date, time, ids)){
    setHint("That date/time slot already has a reservation. Choose another time.", "bad");
    return;
  }

  const res = {
    id: `R_${Date.now()}_${Math.floor(Math.random()*10000)}`,
    name,
    contact,
    pax,
    date,
    time,
    notes,
    status: "Reserved",
    spaceIds: ids,
    createdAt: new Date().toISOString()
  };

  reservations.push(res);
  saveReservations();

  selectedIds.clear();
  updateVisualStates();
  updateSelectedSummary();
  renderReservationList();
  form.reset();

  setHint("✅ Reserved successfully!", "good");
});

// Set default date = today
(function initDefaults(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  $("#date").value = `${yyyy}-${mm}-${dd}`;
})();

// Initial render
updateVisualStates();
updateSelectedSummary();
renderReservationList();